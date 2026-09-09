import { storageService } from './storageService.js';
import { DEFAULT_SETTINGS, GROUPS, PARACHUTE_CONTEXT, SHOPPING_BAG_CASE, SCORE_FIELDS, Q2_ALLOWED_VALUES, sharedTaskContext } from '../config/researchConfig.js';

const iso = () => new Date().toISOString();
const err = (message, status = 400, code = 'research_error') => Object.assign(new Error(message), { status, code });

function cleanText(v, max = 4000) { return String(v ?? '').trim().slice(0, max); }
function choice(v, allowed, fallback = '') { const x = cleanText(v, 100); return allowed.includes(x) ? x : fallback; }
function num(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; }
function calcMean(values) { const xs = values.filter(v => v !== null); return xs.length ? Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*1000)/1000 : null; }

export function sanitizeTest(payload = {}, trialCount = 3) {
  const values = [num(payload.test_1), num(payload.test_2), num(payload.test_3)];
  const used = values.slice(0, trialCount);
  return {
    test_1: values[0], test_2: values[1], test_3: trialCount === 3 ? values[2] : null,
    mean_descent_time: calcMean(used),
    opened: choice(payload.opened, ['yes','no','unsure']),
    sway: choice(payload.sway, ['none','some','strong']),
    rotation: choice(payload.rotation, ['none','some','strong']),
    drift: choice(payload.drift, ['none','some','strong']),
    stable_canopy: choice(payload.stable_canopy, ['yes','partial','no','unsure']),
    other_observation: cleanText(payload.other_observation),
  };
}

class ResearchService {
  async readJson(key, fallback = null) {
    const raw = await storageService.getObject(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  async writeJson(key, value) { await storageService.putObject(key, JSON.stringify(value)); return value; }

  async getSettings() {
    const saved = await this.readJson('settings/system.json', {});
    return { ...DEFAULT_SETTINGS, ...saved };
  }
  async saveSettings(patch = {}) {
    const current = await this.getSettings();
    const next = {
      ...current,
      practice_open: Boolean(patch.practice_open),
      formal_v2_open: Boolean(patch.formal_v2_open),
      ai_stage_open: Boolean(patch.ai_stage_open),
      v3_submission_open: Boolean(patch.v3_submission_open),
      number_of_test_trials: Number(patch.number_of_test_trials) === 2 ? 2 : 3,
      max_chat_minutes: Math.min(90, Math.max(1, Number(patch.max_chat_minutes) || 25)),
      shared_rules_of_thumb: cleanText(patch.shared_rules_of_thumb, 10000),
      updated_at: iso(),
    };
    return this.writeJson('settings/system.json', next);
  }

  async getStudent(studentId) {
    const saved = await this.readJson(`students/${studentId}.json`, {});
    return {
      student_id: studentId,
      group: GROUPS.includes(saved.group) ? saved.group : 'unassigned',
      group_assigned_at: saved.group_assigned_at || null,
      match_pair_id: cleanText(saved.match_pair_id, 100),
      match_pair_assigned_at: saved.match_pair_assigned_at || null,
      created_at: saved.created_at || iso(),
      last_active_at: saved.last_active_at || null,
    };
  }
  async touchStudent(studentId) {
    const s = await this.getStudent(studentId);
    if (!s.created_at) s.created_at = iso();
    s.last_active_at = iso();
    await this.writeJson(`students/${studentId}.json`, s);
    return s;
  }
  async setGroup(studentId, group, actor = 'admin', confirmAfterFormal = false) {
    if (!GROUPS.includes(group)) throw err('分组值无效');
    const formalChat = await this.getChatSession(studentId, 'formal');
    if (formalChat?.started_at && !confirmAfterFormal) throw err('该学生已经进入正式AI讨论，修改组别需要二次确认。', 409, 'group_confirm_required');
    const student = await this.getStudent(studentId);
    const before = student.group;
    student.group = group;
    student.group_assigned_at = iso();
    student.last_active_at = iso();
    await this.writeJson(`students/${studentId}.json`, student);
    const log = { student_id: studentId, match_pair_id: student.match_pair_id || '', from: before, to: group, actor, created_at: iso() };
    await this.writeJson(`group-assignment-log/${Date.now()}_${studentId}.json`, log);
    return student;
  }

  async setMatching(studentId, { match_pair_id = '', group = 'unassigned' } = {}, actor = 'admin', confirmAfterFormal = false) {
    if (!GROUPS.includes(group)) throw err('分组值无效');
    const formalChat = await this.getChatSession(studentId, 'formal');
    if (formalChat?.started_at && !confirmAfterFormal) throw err('该学生已经进入正式AI讨论，修改匹配或组别需要二次确认。', 409, 'group_confirm_required');
    const student = await this.getStudent(studentId);
    const before = { match_pair_id: student.match_pair_id || '', group: student.group };
    const pair = cleanText(match_pair_id, 100);
    student.match_pair_id = pair;
    student.match_pair_assigned_at = pair ? iso() : null;
    student.group = group;
    student.group_assigned_at = group === 'unassigned' ? null : iso();
    student.last_active_at = iso();
    await this.writeJson(`students/${studentId}.json`, student);
    await this.writeJson(`group-assignment-log/${Date.now()}_${studentId}.json`, {
      student_id: studentId,
      from_match_pair_id: before.match_pair_id,
      to_match_pair_id: pair,
      from: before.group,
      to: group,
      actor,
      created_at: iso(),
    });
    return student;
  }

  async getPractice(studentId) {
    return this.readJson(`practice_sessions/${studentId}.json`, {
      student_id: studentId, task_type: 'practice', formal_data: false,
      before_locked: false, chat_completed: false, completed: false,
      created_at: iso(), updated_at: iso(),
    });
  }
  async lockPracticeBefore(studentId, judgment) {
    const record = await this.getPractice(studentId);
    if (record.before_locked) throw err('练习中的首次判断已经锁定，不能覆盖。', 409);
    const text = cleanText(judgment);
    if (!text) throw err('请先填写你的判断');
    Object.assign(record, { practice_judgment_before: text, before_locked: true, before_submitted_at: iso(), updated_at: iso() });
    return this.writeJson(`practice_sessions/${studentId}.json`, record);
  }
  async completePractice(studentId, payload = {}) {
    const record = await this.getPractice(studentId);
    if (!record.before_locked) throw err('请先完成练习中的首次判断', 409);
    if (!record.chat_completed) throw err('请先结束练习AI讨论', 409);
    const after = cleanText(payload.practice_judgment_after);
    const decision = cleanText(payload.practice_final_decision);
    if (!after || !decision) throw err('请完成AI后的判断和最终处理决定');
    Object.assign(record, { practice_judgment_after: after, practice_final_decision: decision, completed: true, completed_at: iso(), updated_at: iso() });
    return this.writeJson(`practice_sessions/${studentId}.json`, record);
  }

  async getV2Evidence(studentId) {
    const v2 = await this.readJson(`prototype_tests/${studentId}/V2.json`, null);
    if (v2 && (v2.P2_mean === undefined || v2.P2_mean === null) && v2.mean_descent_time !== undefined) v2.P2_mean = v2.mean_descent_time;
    return v2;
  }
  async saveV2Evidence(studentId, payload = {}) {
    const existingJudgment = await this.getJudgmentBefore(studentId);
    if (existingJudgment?.locked) throw err('AI前判断已锁定，V2证据不能再被学生覆盖。', 409);
    const settings = await this.getSettings();
    const test = sanitizeTest(payload, settings.number_of_test_trials);
    const required = [test.test_1, test.test_2].every(v => v !== null) && (settings.number_of_test_trials === 2 || test.test_3 !== null);
    if (!required) throw err(`请填写${settings.number_of_test_trials}次测试时间`);
    const current = await this.getV2Evidence(studentId) || { student_id: studentId, version: 'V2', created_at: iso(), photos: [] };
    Object.assign(current, test, { P2_mean: test.mean_descent_time, updated_at: iso() });
    await this.writeJson(`prototype_tests/${studentId}/V2.json`, current);
    await this.ensureFormalSession(studentId);
    return current;
  }

  async getJudgmentBefore(studentId) { return this.readJson(`judgments/${studentId}/before.json`, null); }
  async lockJudgmentBefore(studentId, payload = {}) {
    const current = await this.getJudgmentBefore(studentId);
    if (current?.locked) throw err('AI前判断已经提交，原始版本不会被覆盖。', 409);
    const evidence = await this.getV2Evidence(studentId);
    if (!evidence) throw err('请先保存V2测试证据', 409);
    if (!(evidence.photos || []).length) throw err('请先上传至少1张V2照片', 409);
    const obj = {
      student_id: studentId,
      judgment_before_problem: cleanText(payload.judgment_before_problem),
      judgment_before_evidence: cleanText(payload.judgment_before_evidence),
      judgment_before_idea: cleanText(payload.judgment_before_idea),
      locked: true, submitted_at: iso(),
    };
    if (!obj.judgment_before_problem || !obj.judgment_before_evidence) throw err('请完成问题判断和证据依据');
    if (!obj.judgment_before_idea) obj.judgment_before_idea = '不确定/暂时没有';
    await this.writeJson(`judgments/${studentId}/before.json`, obj);
    const formal = await this.ensureFormalSession(studentId); formal.formal_started = true; formal.formal_started_at ||= iso(); await this.writeJson(`formal_sessions/${studentId}.json`, formal);
    return obj;
  }

  async getDecision(studentId) { return this.readJson(`final_decisions/${studentId}.json`, null); }
  async lockDecision(studentId, payload = {}) {
    const old = await this.getDecision(studentId);
    if (old?.locked) throw err('最终决定已经提交，不能覆盖。', 409);
    const chat = await this.getChatSession(studentId, 'formal');
    if (!chat?.ended_at) throw err('请先结束AI讨论', 409);
    const obj = {
      student_id: studentId,
      decision_after_problem: cleanText(payload.decision_after_problem),
      decision_after_change: cleanText(payload.decision_after_change),
      decision_after_reason: cleanText(payload.decision_after_reason),
      decision_after_test: cleanText(payload.decision_after_test),
      locked: true, submitted_at: iso(),
    };
    if (!obj.decision_after_problem || !obj.decision_after_change || !obj.decision_after_reason || !obj.decision_after_test) throw err('请完成全部最终决定字段');
    await this.writeJson(`final_decisions/${studentId}.json`, obj);
    return obj;
  }

  async getV3(studentId) { return this.readJson(`prototype_tests/${studentId}/V3.json`, null); }
  async saveV3(studentId, payload = {}) {
    const decision = await this.getDecision(studentId);
    if (!decision?.locked) throw err('请先提交AI后的最终决定', 409);
    const old = await this.getV3(studentId);
    if (old?.locked) throw err('V3最终提交已经锁定，不能覆盖。', 409);
    if (!(old?.photos || []).length) throw err('请先上传至少1张V3照片', 409);
    const settings = await this.getSettings();
    const test = sanitizeTest(payload, settings.number_of_test_trials);
    const required = [test.test_1, test.test_2].every(v => v !== null) && (settings.number_of_test_trials === 2 || test.test_3 !== null);
    if (!required) throw err(`请填写${settings.number_of_test_trials}次V3测试时间`);
    const obj = {
      ...(old || {}), student_id: studentId, version: 'V3',
      actual_revision: cleanText(payload.actual_revision),
      revision_difference: cleanText(payload.revision_difference),
      ...test,
      locked: true, submitted_at: iso(), photos: old?.photos || [],
    };
    if (!obj.actual_revision) throw err('请填写你实际上修改了哪些地方');
    await this.writeJson(`prototype_tests/${studentId}/V3.json`, obj);
    return obj;
  }

  async getReflection(studentId) { return this.readJson(`reflections/${studentId}.json`, null); }
  async saveReflection(studentId, payload = {}) {
    const v3 = await this.getV3(studentId);
    if (!v3?.locked) throw err('请先提交V3测试结果', 409);
    const old = await this.getReflection(studentId);
    if (old?.locked) throw err('反思已经提交，不能覆盖。', 409);
    const obj = {
      student_id: studentId,
      result_match: choice(payload.result_match, ['same','partial','different']),
      strongest_evidence: cleanText(payload.strongest_evidence),
      reconsider_next: cleanText(payload.reconsider_next),
      locked: true, submitted_at: iso(),
    };
    if (!obj.result_match || !obj.strongest_evidence || !obj.reconsider_next) throw err('请完成全部反思问题');
    await this.writeJson(`reflections/${studentId}.json`, obj);
    const formal = await this.ensureFormalSession(studentId); formal.v3_completed = true; formal.v3_completed_at = iso(); await this.writeJson(`formal_sessions/${studentId}.json`, formal);
    return obj;
  }

  async ensureFormalSession(studentId) {
    const existing = await this.readJson(`formal_sessions/${studentId}.json`, null);
    if (existing) {
      existing.research_scores ||= {};
      for (const key of SCORE_FIELDS) if (!(key in existing.research_scores)) existing.research_scores[key] = null;
      return existing;
    }
    const obj = { student_id: studentId, task_type: 'formal', formal_data: true, formal_started: false, chat_completed: false, v3_completed: false, research_scores: Object.fromEntries(SCORE_FIELDS.map(k => [k, null])), created_at: iso(), updated_at: iso() };
    await this.writeJson(`formal_sessions/${studentId}.json`, obj); return obj;
  }
  async patchResearchScores(studentId, scores = {}) {
    const formal = await this.ensureFormalSession(studentId);
    formal.research_scores ||= {};
    for (const key of SCORE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(scores, key)) continue;
      if (scores[key] === '' || scores[key] === null || scores[key] === undefined) { formal.research_scores[key] = null; continue; }
      const value = Number(scores[key]);
      if (!Number.isFinite(value)) throw err(`${key}评分无效`);
      if (key === 'Q2' && !Q2_ALLOWED_VALUES.includes(value)) throw err('Q2只能填写0、2.5、5、7.5或10');
      formal.research_scores[key] = value;
    }
    formal.updated_at = iso(); return this.writeJson(`formal_sessions/${studentId}.json`, formal);
  }

  async getChatSession(studentId, scope) {
    return this.readJson(`chat_sessions/${studentId}/${scope}.json`, null);
  }
  async ensureChatSession(studentId, scope, mode) {
    let s = await this.getChatSession(studentId, scope);
    if (s) return s;
    s = { student_id: studentId, task_type: scope, mode, session_id: `${scope}_${studentId}_${Date.now()}`, conversation_id: null, started_at: iso(), ended_at: null, chat_duration: null, chat_duration_seconds: null, user_turn_count: 0, assistant_turn_count: 0, context_sent: false, next_message_index: 1, created_at: iso() };
    await this.writeJson(`chat_sessions/${studentId}/${scope}.json`, s); return s;
  }
  async updateChatSession(studentId, scope, patch = {}) {
    const current = await this.getChatSession(studentId, scope);
    if (!current) throw err('聊天会话不存在', 404);
    Object.assign(current, patch, { updated_at: iso() });
    return this.writeJson(`chat_sessions/${studentId}/${scope}.json`, current);
  }
  async endChat(studentId, scope) {
    const current = await this.getChatSession(studentId, scope);
    if (!current) throw err('聊天会话不存在', 404);
    if (!current.ended_at) {
      current.ended_at = iso();
      current.chat_duration_seconds = Math.max(0, Math.round((Date.parse(current.ended_at) - Date.parse(current.started_at))/1000));
      current.chat_duration = current.chat_duration_seconds;
      await this.writeJson(`chat_sessions/${studentId}/${scope}.json`, current);
    }
    if (scope === 'practice') {
      const p = await this.getPractice(studentId); p.chat_completed = true; p.chat_completed_at = current.ended_at; p.updated_at = iso(); await this.writeJson(`practice_sessions/${studentId}.json`, p);
    } else {
      const f = await this.ensureFormalSession(studentId); f.chat_completed = true; f.chat_completed_at = current.ended_at; f.updated_at = iso(); await this.writeJson(`formal_sessions/${studentId}.json`, f);
    }
    return current;
  }

  async addMessage(studentId, scope, message) {
    const session = await this.getChatSession(studentId, scope);
    if (!session) throw err('聊天会话不存在', 404);
    const index = session.next_message_index || 1;
    const record = { ...message, student_id: studentId, task_type: scope, session_id: session.session_id, message_index: index, created_at: message.created_at || iso() };
    await this.writeJson(`chat_messages/${studentId}/${scope}/${String(index).padStart(5,'0')}.json`, record);
    session.next_message_index = index + 1;
    session.user_turn_count = Number(session.user_turn_count || 0) + (record.role === 'user' ? 1 : 0);
    session.assistant_turn_count = Number(session.assistant_turn_count || 0) + (record.role === 'assistant' ? 1 : 0);
    session.updated_at = iso(); await this.writeJson(`chat_sessions/${studentId}/${scope}.json`, session);
    return record;
  }
  async getMessages(studentId, scope) {
    const blobs = await storageService.listObjects(`chat_messages/${studentId}/${scope}/`);
    const rows = [];
    for (const b of blobs.sort((a,b)=>a.key.localeCompare(b.key))) {
      const raw = await storageService.getObject(b.key); if (!raw) continue;
      try { rows.push(JSON.parse(raw)); } catch {}
    }
    return rows.sort((a,b)=>(a.message_index||0)-(b.message_index||0));
  }

  async getStudentState(studentId) {
    const [settings, student, practice, formal, v2, before, chat, decision, v3, reflection] = await Promise.all([
      this.getSettings(), this.getStudent(studentId), this.getPractice(studentId), this.ensureFormalSession(studentId), this.getV2Evidence(studentId), this.getJudgmentBefore(studentId), this.getChatSession(studentId,'formal'), this.getDecision(studentId), this.getV3(studentId), this.getReflection(studentId)
    ]);
    const v2Ready = Boolean(v2 && v2.test_1 !== null && v2.test_1 !== undefined && v2.test_2 !== null && v2.test_2 !== undefined && (settings.number_of_test_trials === 2 || (v2.test_3 !== null && v2.test_3 !== undefined)));
    let current_stage = 'home';
    if (reflection?.locked) current_stage = 'complete';
    else if (v3?.locked) current_stage = 'reflection';
    else if (decision?.locked) current_stage = 'v3';
    else if (chat?.ended_at) current_stage = 'decision';
    else if (before?.locked) current_stage = 'ai';
    else if (v2Ready) current_stage = 'judgment_before';
    else if (formal.formal_started || v2) current_stage = 'formal_v2';
    return {
      student_id: studentId,
      current_stage,
      practice_completed: Boolean(practice.completed),
      formal_started: Boolean(formal.formal_started || v2 || before),
      chat_completed: Boolean(formal.chat_completed || chat?.ended_at),
      v3_completed: Boolean(formal.v3_completed || reflection?.locked),
      openings: {
        practice_open: settings.practice_open,
        formal_v2_open: settings.formal_v2_open,
        ai_stage_open: settings.ai_stage_open,
        v3_submission_open: settings.v3_submission_open,
      },
      formal_ai_eligible: ['structured','autonomous'].includes(student.group),
      number_of_test_trials: settings.number_of_test_trials,
      max_chat_minutes: settings.max_chat_minutes,
    };
  }

  async buildFormalAiContext(studentId) {
    const [settings, v2, before] = await Promise.all([this.getSettings(), this.getV2Evidence(studentId), this.getJudgmentBefore(studentId)]);
    return `${sharedTaskContext(settings)}\n\n【学生自己的V2测试证据】\n${JSON.stringify(v2 || {}, null, 2)}\n\n【学生在AI讨论前锁定的判断】\n${JSON.stringify(before || {}, null, 2)}\n\n请只依据以上已提供信息与学生后续消息交流。不要假设V3结果、不要引用其他学生、不要提及研究组别或研究评分。`;
  }
  async buildPracticeAiContext(studentId) {
    const p = await this.getPractice(studentId);
    return `【Shopping Bag Failure Practice】\n${SHOPPING_BAG_CASE.evidence.map(x=>`- ${x}`).join('\n')}\n\n【学生讨论前的判断】\n${p.practice_judgment_before || ''}\n\n这是平台练习。请正常连续交流，不要替学生自动填写最终决定。`;
  }

  async addPhoto(studentId, version, meta) {
    if (!['V2','V3'].includes(version)) throw err('只允许上传V2或V3照片');
    const key = `prototype_tests/${studentId}/${version}.json`;
    const current = await this.readJson(key, { student_id: studentId, version, photos: [], created_at: iso() });
    current.photos ||= [];
    if (current.photos.length >= 3) throw err('每个版本最多上传3张照片', 409);
    current.photos.push(meta); current.updated_at = iso(); await this.writeJson(key, current); return current.photos;
  }

  async getCompleteStudentData(studentId) {
    const [student, practice, formal, v2, before, formalChat, formalMessages, practiceChat, practiceMessages, decision, v3, reflection] = await Promise.all([
      this.getStudent(studentId), this.getPractice(studentId), this.ensureFormalSession(studentId), this.getV2Evidence(studentId), this.getJudgmentBefore(studentId), this.getChatSession(studentId,'formal'), this.getMessages(studentId,'formal'), this.getChatSession(studentId,'practice'), this.getMessages(studentId,'practice'), this.getDecision(studentId), this.getV3(studentId), this.getReflection(studentId)
    ]);
    return { student, practice: { ...practice, chat_session: practiceChat, chat: practiceMessages }, formal: { session: formal, V2: v2, judgment_before: before, chat_session: formalChat, chat: formalMessages, decision_after: decision, V3: v3, reflection } };
  }

  staticContent() { return { parachute: PARACHUTE_CONTEXT, practice: SHOPPING_BAG_CASE }; }
}

export const researchService = new ResearchService();
