import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sessionService } from '../services/sessionService.js';
import { cozeService } from '../services/cozeService.js';
import { logService } from '../services/logService.js';
import { storageService } from '../services/storageService.js';
import { researchService } from '../services/researchService.js';
import { validateMessage, validateParticipantId } from '../utils/validators.js';

const router = express.Router();

function allowedParticipant(participantId) {
  if (!validateParticipantId(participantId)) return false;
  return (process.env.ALLOWED_PARTICIPANTS || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .includes(participantId);
}

function imageMimeFromName(name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' })[ext] || 'image/jpeg';
}

router.post('/chat', async (req, res) => {
  const requestStartedAt = new Date().toISOString();
  const { participantId, sessionId, message, imageId } = req.body || {};
  const upperId = String(participantId || '').toUpperCase().trim();

  if (!upperId || !sessionId || !message) return res.status(400).json({ error: '缺少必要参数' });
  if (!allowedParticipant(upperId)) return res.status(403).json({ error: '未授权的参与者' });
  if (!validateMessage(message)) return res.status(400).json({ error: '消息内容为空或过长' });

  const session = await sessionService.getSession(sessionId);
  if (!session || session.active === false || session.participant_id !== upperId) {
    return res.status(404).json({ error: '会话不存在或已过期' });
  }

  let state;
  let record;
  try {
    state = await researchService.getParticipantState(upperId);
    if (!state.ai_enabled) return res.status(409).json({ error: '当前课程阶段不开放AI，请按老师安排完成活动。' });
    record = await researchService.getRecord(upperId, state.formal_data);
    if (!record.pre_ai_locked) return res.status(409).json({ error: '请先完成并提交AI前独立判断。' });
    if (record.final_decision_locked) return res.status(409).json({ error: '最终决定已经提交，本轮AI对话已结束。' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || '读取研究状态失败' });
  }

  const mode = state.formal_data ? state.group : 'practice';
  const scope = state.formal_data ? 'formal' : 'practice';
  let imageBuffer = null;
  let imageMime = null;

  try {
    if (imageId) {
      const imagePath = `images/${upperId}/${sessionId}/${imageId}`;
      const buffer = await storageService.getObjectBuffer(imagePath);
      if (!buffer) throw Object.assign(new Error('image_unavailable'), { code: 'image_unavailable' });
      imageBuffer = Buffer.from(buffer);
      imageMime = imageMimeFromName(imageId);
    }

    const conversationInfo = await researchService.getConversationInfo(upperId, state.formal_data);
    let messageForAi = message;
    let contextInjected = false;
    if (!conversationInfo.context_sent) {
      messageForAi = `${researchService.buildAiContext(state.formal_data, state, record)}\n\n【学生当前消息】\n${message}`;
      contextInjected = true;
      if (!imageBuffer && state.formal_data && record.V2_photo?.path) {
        const buffer = await storageService.getObjectBuffer(record.V2_photo.path);
        if (buffer) {
          imageBuffer = Buffer.from(buffer);
          imageMime = record.V2_photo.mime || imageMimeFromName(record.V2_photo.filename || 'photo.jpg');
        }
      }
    }

    const result = await cozeService.sendMessage({
      participantId: upperId,
      sessionId,
      mode,
      scope,
      message: messageForAi,
      conversationId: conversationInfo.conversation_id,
      imageBuffer,
      imageMime,
    });

    await researchService.setConversationInfo(upperId, state.formal_data, result.conversation_id, contextInjected || conversationInfo.context_sent);
    await researchService.incrementAiTurn(upperId, state.formal_data);
    await sessionService.incrementTurn(sessionId);
    const updatedSession = await sessionService.getSession(sessionId);
    const turnNumber = updatedSession.turn_count;
    const fullResponseSeconds = Math.round((Date.parse(result.answer_time) - Date.parse(requestStartedAt)) / 100) / 10;
    const eventId = `event_${Date.now()}_${uuidv4().replace(/-/g, '')}`;

    await logService.logInteraction({
      event_id: eventId,
      experiment_run_id: process.env.EXPERIMENT_RUN_ID || 'default',
      participant_id: upperId,
      group: state.group || '',
      mode,
      task: state.task,
      formal_data: state.formal_data,
      current_stage: state.current_stage,
      conversation_scope: scope,
      bot_id: result.bot_id,
      session_id: sessionId,
      conversation_session_id: session.conversation_session_id || sessionId,
      conversation_session_no: session.conversation_session_no || 1,
      conversation_id: result.conversation_id,
      chat_id: result.chat_id,
      turn_number: turnNumber,
      user_message: message,
      assistant_message: result.assistant_message,
      request_started_at: requestStartedAt,
      send_time: result.send_time,
      answer_time: result.answer_time,
      response_seconds: fullResponseSeconds,
      status: result.status,
      has_image: Boolean(imageBuffer),
      image_id: imageId || (record.V2_photo?.filename || ''),
      context_injected: contextInjected,
    });

    res.json({
      success: true,
      message: result.assistant_message,
      chatId: result.chat_id,
      conversationId: result.conversation_id,
    });
  } catch (err) {
    console.error('Chat error:', err);
    const now = new Date().toISOString();
    const errorCode = err.code || (err.message === 'timeout' ? 'timeout' : 'failed');
    const errorMessage = err.code === 'image_unavailable'
      ? '图片读取失败，请重新上传后再发送。'
      : err.message === 'timeout'
        ? '回复超时，请重试。'
        : '回复失败，请重试。';

    try {
      await logService.logInteraction({
        event_id: `error_${Date.now()}_${uuidv4().replace(/-/g, '')}`,
        experiment_run_id: process.env.EXPERIMENT_RUN_ID || 'default',
        participant_id: upperId,
        group: state?.group || '',
        mode: state?.formal_data ? state.group : 'practice',
        task: state?.task || '',
        formal_data: Boolean(state?.formal_data),
        current_stage: state?.current_stage || '',
        conversation_scope: state?.formal_data ? 'formal' : 'practice',
        bot_id: state ? cozeService.getBotId(state.formal_data ? state.group : 'practice') : '',
        session_id: sessionId,
        conversation_id: 'unknown',
        chat_id: `error_${Date.now()}`,
        turn_number: (session.turn_count || 0) + 1,
        user_message: message,
        assistant_message: '',
        request_started_at: requestStartedAt,
        send_time: requestStartedAt,
        answer_time: now,
        response_seconds: Math.round((Date.parse(now) - Date.parse(requestStartedAt)) / 100) / 10,
        status: 'failed',
        has_image: Boolean(imageBuffer),
        image_id: imageId || '',
        error_code: errorCode,
        error_message: err.message,
      });
    } catch (logErr) {
      console.error('Error logging failed interaction:', logErr);
    }
    res.status(500).json({ error: errorMessage });
  }
});

router.get('/history', async (req, res) => {
  try {
    const upperId = String(req.query?.participantId || '').toUpperCase().trim();
    const sessionId = String(req.query?.sessionId || '');
    if (!upperId || !sessionId) return res.status(400).json({ error: '缺少参数' });
    if (!allowedParticipant(upperId)) return res.status(403).json({ error: '未授权' });

    const session = await sessionService.getSession(sessionId);
    if (!session || session.active === false || session.participant_id !== upperId) return res.status(404).json({ error: '会话不存在' });
    const state = await researchService.getParticipantState(upperId);
    const scope = state.formal_data ? 'formal' : 'practice';
    const logs = (await logService.getParticipantLogs(upperId))
      .filter(log => log.status === 'completed' && log.conversation_scope === scope)
      .sort((a, b) => new Date(a.send_time) - new Date(b.send_time));

    const messages = [];
    for (const log of logs) {
      if (log.user_message) messages.push({ role: 'user', content: log.user_message });
      if (log.assistant_message) messages.push({ role: 'assistant', content: log.assistant_message });
    }
    res.json({ messages });
  } catch (err) {
    console.error('History error:', err);
    res.status(err.status || 500).json({ error: err.message || '获取历史记录失败' });
  }
});

export default router;
