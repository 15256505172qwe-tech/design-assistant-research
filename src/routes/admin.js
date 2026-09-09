import express from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { logService } from '../services/logService.js';
import { sessionService } from '../services/sessionService.js';
import { storageService } from '../services/storageService.js';
import { researchService } from '../services/researchService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

function configuredParticipantIds() {
  return (process.env.ALLOWED_PARTICIPANTS || '')
    .split(',')
    .map(id => id.trim().toUpperCase())
    .filter(Boolean);
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

router.post('/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: '请输入密码' });
    if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: '服务器未配置 ADMIN_PASSWORD' });
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: '密码错误' });

    const sessionId = `admin_${uuidv4().replace(/-/g, '')}`;
    const sessionData = {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };
    await storageService.putObject(`admin-sessions/${sessionId}.json`, JSON.stringify(sessionData));
    res.cookie('admin_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000,
      path: '/',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: '管理员登录服务异常' });
  }
});

router.post('/logout', requireAdmin, async (req, res) => {
  const sessionId = req.cookies.admin_session;
  if (sessionId) await storageService.deleteObject(`admin-sessions/${sessionId}.json`);
  res.clearCookie('admin_session', { path: '/' });
  res.json({ success: true });
});

router.get('/course-stage', requireAdmin, async (req, res) => {
  try {
    const current = await researchService.getCurrentStage();
    res.json({ current, options: researchService.getStageOptions() });
  } catch (err) {
    res.status(500).json({ error: '获取课程阶段失败' });
  }
});

router.post('/course-stage', requireAdmin, async (req, res) => {
  try {
    const saved = await researchService.setCurrentStage(req.body?.current_stage);
    res.json({ success: true, ...saved });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '课程阶段保存失败' });
  }
});

router.get('/participants', requireAdmin, async (req, res) => {
  try {
    const logParticipants = await logService.getAllParticipants();
    const byId = new Map(logParticipants.map(item => [item.participant_id, item]));
    const ids = Array.from(new Set([...configuredParticipantIds(), ...byId.keys()])).sort();
    const result = [];
    for (const participantId of ids) {
      const profile = await researchService.getParticipantProfile(participantId);
      const record = await researchService.getRecord(participantId, true);
      const logInfo = byId.get(participantId) || {};
      result.push({
        participant_id: participantId,
        group: profile.group,
        total_turns: logInfo.total_turns || 0,
        last_activity: logInfo.last_activity || profile.last_active || null,
        baseline_ready: Boolean(record.V2_test_data && record.actual_modification_v1_v2),
        pre_ai_locked: Boolean(record.pre_ai_locked),
        final_decision_locked: Boolean(record.final_decision_locked),
        interview_selected: Boolean(record.interview_selected),
      });
    }
    res.json(result);
  } catch (err) {
    console.error('Get participants error:', err);
    res.status(500).json({ error: '获取参与者列表失败' });
  }
});

router.post('/participant/:participantId/group', requireAdmin, async (req, res) => {
  try {
    const participantId = String(req.params.participantId || '').toUpperCase().trim();
    const profile = await researchService.setGroup(participantId, req.body?.group);
    res.json({ success: true, participant: profile });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '分组保存失败' });
  }
});

router.get('/participant/:participantId', requireAdmin, async (req, res) => {
  try {
    const participantId = String(req.params.participantId || '').toUpperCase().trim();
    const [logs, profile, formalRecord, practiceRecord] = await Promise.all([
      logService.getParticipantLogs(participantId),
      researchService.getParticipantProfile(participantId),
      researchService.getRecord(participantId, true),
      researchService.getRecord(participantId, false),
    ]);
    res.json({ participant_id: participantId, profile, formal_record: formalRecord, practice_record: practiceRecord, logs });
  } catch (err) {
    console.error('Get participant detail error:', err);
    res.status(500).json({ error: '获取参与者资料失败' });
  }
});

router.post('/participant/:participantId/research', requireAdmin, async (req, res) => {
  try {
    const participantId = String(req.params.participantId || '').toUpperCase().trim();
    const record = await researchService.adminPatchFormalRecord(participantId, req.body?.data || {});
    res.json({ success: true, record });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '保存研究资料失败' });
  }
});

router.post('/participant/:participantId/reset-conversation', requireAdmin, async (req, res) => {
  try {
    const participantId = String(req.params.participantId || '').toUpperCase().trim();
    const session = await sessionService.startNewConversation(participantId);
    res.json({ success: true, participant_id: participantId, conversation_session_no: session.conversation_session_no });
  } catch (err) {
    console.error('Reset conversation error:', err);
    res.status(500).json({ error: '开启新网页会话失败' });
  }
});

router.get('/export-research-csv', requireAdmin, async (req, res) => {
  try {
    const headers = [
      'participant_id','group','V1_photo','V1_test_data','V1_problem','V1_problem_evidence','V1_revision_options','V1_selected_revision','V1_selection_reason',
      'actual_modification_v1_v2','V2_photo','V2_test_data','V2_reflection','pre_ai_problem','pre_ai_evidence','pre_ai_revision_options','pre_ai_preferred_revision','pre_ai_preference_reason','pre_ai_locked_at',
      'formal_conversation_id','post_ai_problem','post_ai_final_revision','post_ai_final_reason','final_decision_locked_at','V3_photo','actual_modification_v2_v3','V3_test_data','V3_reflection',
      'G0','E0','H0','I0','G1','E1','H1','I1','Q_V1','Q_V2','Q_V3','external_ai_use','external_ai_frequency','external_ai_changed_design','interview_selected','interview_status','interview_date','interview_notes'
    ];
    const lines = [headers.join(',')];
    for (const participantId of configuredParticipantIds()) {
      const [profile, record] = await Promise.all([
        researchService.getParticipantProfile(participantId),
        researchService.getRecord(participantId, true),
      ]);
      const row = { ...record, participant_id: participantId, group: profile.group || '' };
      for (const version of ['V1','V2','V3']) row[`${version}_photo`] = record[`${version}_photo`]?.path || '';
      lines.push(headers.map(h => csvEscape(row[h])).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=research_records.csv');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    console.error('Export research CSV error:', err);
    res.status(500).json({ error: '导出研究记录失败' });
  }
});

router.get('/export-chat-jsonl', requireAdmin, async (req, res) => {
  try {
    const logs = await logService.getAllLogs();
    const formalLogs = logs.filter(log => log.formal_data === true);
    const text = formalLogs.map(log => JSON.stringify(log)).join('\n') + (formalLogs.length ? '\n' : '');
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=chat_messages.jsonl');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: '导出聊天记录失败' });
  }
});

router.get('/export-interviews-csv', requireAdmin, async (req, res) => {
  try {
    const headers = ['participant_id','group','interview_selected','interview_status','interview_date','interview_notes'];
    const lines = [headers.join(',')];
    for (const participantId of configuredParticipantIds()) {
      const [profile, record] = await Promise.all([
        researchService.getParticipantProfile(participantId),
        researchService.getRecord(participantId, true),
      ]);
      const row = { participant_id: participantId, group: profile.group || '', ...record };
      lines.push(headers.map(h => csvEscape(row[h])).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=interview_cases.csv');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: '导出访谈表失败' });
  }
});

export default router;
