import express from 'express';
import { sessionService } from '../services/sessionService.js';
import { validateParticipantId } from '../utils/validators.js';
import { researchService } from '../services/researchService.js';

const router = express.Router();

function normalizeParticipantId(value) {
  return String(value || '').toUpperCase().trim();
}

function assertAllowedParticipant(participantId) {
  if (!validateParticipantId(participantId)) {
    throw Object.assign(new Error('匿名编号格式不正确，请输入例如 P01。'), { status: 400 });
  }
  const allowedList = (process.env.ALLOWED_PARTICIPANTS || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  if (!allowedList.includes(participantId)) {
    throw Object.assign(new Error('编号不在当前课程名单中，请核对后重新输入。'), { status: 403 });
  }
}

router.post('/validate', async (req, res) => {
  try {
    const participantId = normalizeParticipantId(req.body?.participantId);
    if (!participantId) return res.status(400).json({ valid: false, message: '请输入老师发给你的匿名编号。' });
    assertAllowedParticipant(participantId);
    const session = await sessionService.getOrCreateSession(participantId);
    const state = await researchService.getParticipantState(participantId);
    res.json({
      valid: true,
      participantId,
      sessionId: session.session_id,
      current_stage: state.current_stage,
      stage_label: state.stage_label,
      task: state.task,
      formal_data: state.formal_data,
      version: state.version,
      phase: state.phase,
      ai_enabled: state.ai_enabled,
    });
  } catch (err) {
    console.error('Validate error:', err);
    res.status(err.status || 500).json({
      valid: false,
      code: err.code || 'validate_error',
      message: err.message || '服务器错误，请稍后重试。',
    });
  }
});

router.get('/research/state', async (req, res) => {
  try {
    const participantId = normalizeParticipantId(req.query?.participantId);
    assertAllowedParticipant(participantId);
    const state = await researchService.getParticipantState(participantId);
    const record = await researchService.getRecord(participantId, state.formal_data);
    const content = researchService.getStaticContent();
    res.json({
      current_stage: state.current_stage,
      stage_label: state.stage_label,
      task: state.task,
      formal_data: state.formal_data,
      version: state.version,
      phase: state.phase,
      ai_enabled: state.ai_enabled,
      record: researchService.getStudentRecord(record),
      content
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '获取研究状态失败', code: err.code });
  }
});

router.post('/research/data', async (req, res) => {
  try {
    const participantId = normalizeParticipantId(req.body?.participantId);
    assertAllowedParticipant(participantId);
    const state = await researchService.getParticipantState(participantId);
    const record = await researchService.saveData(participantId, state.formal_data, req.body?.data || {});
    res.json({ success: true, record: researchService.getStudentRecord(record) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '保存研究资料失败', code: err.code, field: err.field });
  }
});

router.post('/research/pre-ai', async (req, res) => {
  try {
    const participantId = normalizeParticipantId(req.body?.participantId);
    assertAllowedParticipant(participantId);
    const state = await researchService.getParticipantState(participantId);
    if (!state.ai_enabled) return res.status(409).json({ error: '当前课程阶段不开放AI。' });
    const record = await researchService.lockPreAi(participantId, state.formal_data, req.body?.data || {});
    res.json({ success: true, record: researchService.getStudentRecord(record) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '提交AI前判断失败', code: err.code, field: err.field });
  }
});

router.post('/research/final', async (req, res) => {
  try {
    const participantId = normalizeParticipantId(req.body?.participantId);
    assertAllowedParticipant(participantId);
    const state = await researchService.getParticipantState(participantId);
    if (!state.ai_enabled) return res.status(409).json({ error: '当前课程阶段不开放AI。' });
    const record = await researchService.lockFinal(participantId, state.formal_data, req.body?.data || {});
    res.json({ success: true, record: researchService.getStudentRecord(record) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '提交最终决定失败', code: err.code, field: err.field });
  }
});

export default router;
