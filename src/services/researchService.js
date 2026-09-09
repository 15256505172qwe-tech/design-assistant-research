import { storageService } from './storageService.js';
import {
  COURSE_STAGES,
  COURSE_STAGE_OPTIONS,
  DEFAULT_STAGE,
  FORMAL_RECORD_FIELDS,
  PARACHUTE_BRIEF,
  PRACTICE_RECORD_FIELDS,
  SCORE_FIELDS,
  SHOPPING_BAG_PRACTICE,
} from '../config/researchConfig.js';

function now() {
  return new Date().toISOString();
}

function makeError(message, status = 400, code = 'research_error', extra = {}) {
  return Object.assign(new Error(message), { status, code, ...extra });
}

function sanitizeTestData(value) {
  if (!value || typeof value !== 'object') return null;
  const trials = [value.trial_1, value.trial_2, value.trial_3]
    .map(v => Number(v))
    .filter(v => Number.isFinite(v) && v >= 0);
  const mean = trials.length ? Math.round((trials.reduce((a, b) => a + b, 0) / trials.length) * 1000) / 1000 : null;
  return {
    trial_1: Number.isFinite(Number(value.trial_1)) ? Number(value.trial_1) : null,
    trial_2: Number.isFinite(Number(value.trial_2)) ? Number(value.trial_2) : null,
    trial_3: Number.isFinite(Number(value.trial_3)) ? Number(value.trial_3) : null,
    mean_descent_time: mean,
    opened_normally: value.opened_normally === true || value.opened_normally === 'true' || value.opened_normally === 'yes',
    stayed_inflated: value.stayed_inflated === true || value.stayed_inflated === 'true' || value.stayed_inflated === 'yes',
    obvious_sway: value.obvious_sway === true || value.obvious_sway === 'true' || value.obvious_sway === 'yes',
    obvious_flip: value.obvious_flip === true || value.obvious_flip === 'true' || value.obvious_flip === 'yes',
    notes: String(value.notes || '').trim(),
  };
}

class ResearchService {
  async readJson(key, fallback = null) {
    const content = await storageService.getObject(key);
    if (!content) return fallback;
    try {
      return JSON.parse(content);
    } catch (err) {
      console.error(`Invalid JSON in ${key}:`, err);
      return fallback;
    }
  }

  async writeJson(key, value) {
    await storageService.putObject(key, JSON.stringify(value));
    return value;
  }

  getStageOptions() {
    return COURSE_STAGE_OPTIONS;
  }

  getStaticContent() {
    return { parachute: PARACHUTE_BRIEF, practice: SHOPPING_BAG_PRACTICE };
  }

  async getCurrentStage() {
    const stored = await this.readJson('course-state/current.json', null);
    const stageName = stored?.current_stage && COURSE_STAGES[stored.current_stage]
      ? stored.current_stage
      : DEFAULT_STAGE;
    const stage = COURSE_STAGES[stageName];
    return { current_stage: stageName, ...stage };
  }

  async setCurrentStage(stageName) {
    if (!COURSE_STAGES[stageName]) throw makeError('课程阶段无效', 400, 'invalid_stage');
    return this.writeJson('course-state/current.json', { current_stage: stageName, updated_at: now() });
  }

  async getParticipantProfile(participantId) {
    const profile = await this.readJson(`participants/${participantId}.json`, {});
    return {
      ...profile,
      participant_id: participantId,
      group: ['structured', 'autonomous'].includes(profile.group) ? profile.group : null,
    };
  }

  async setGroup(participantId, group) {
    if (!['structured', 'autonomous'].includes(group)) throw makeError('分组无效', 400, 'invalid_group');
    const profile = await this.getParticipantProfile(participantId);
    profile.group = group;
    profile.group_updated_at = now();
    await this.writeJson(`participants/${participantId}.json`, profile);
    return profile;
  }

  async getParticipantState(participantId) {
    const stage = await this.getCurrentStage();
    const profile = await this.getParticipantProfile(participantId);
    if (stage.phase === 'ai' && !profile.group) {
      throw makeError('当前正式AI阶段尚未开放给你的编号，请联系老师。', 409, 'group_required');
    }
    return {
      participant_id: participantId,
      current_stage: stage.current_stage,
      stage_label: stage.label,
      task: stage.task,
      formal_data: stage.formal_data,
      version: stage.version,
      phase: stage.phase,
      ai_enabled: stage.ai_enabled,
      group: profile.group,
      mode: stage.formal_data ? (profile.group || null) : 'practice',
    };
  }

  practiceKey(participantId) {
    return `research/${participantId}/practice-shopping-bag.json`;
  }

  formalKey(participantId) {
    return `research/${participantId}/parachute.json`;
  }

  defaultPracticeRecord(participantId) {
    return {
      participant_id: participantId,
      task: 'shopping_bag',
      formal_data: false,
      pre_ai_locked: false,
      final_decision_locked: false,
      practice_conversation_id: null,
      practice_context_sent: false,
      created_at: now(),
      updated_at: now(),
    };
  }

  defaultFormalRecord(participantId) {
    return {
      participant_id: participantId,
      task: 'parachute',
      formal_data: true,
      pre_ai_locked: false,
      final_decision_locked: false,
      formal_conversation_id: null,
      formal_context_sent: false,
      G0: null,
      E0: null,
      H0: null,
      I0: null,
      G1: null,
      E1: null,
      H1: null,
      I1: null,
      Q_V1: null,
      Q_V2: null,
      Q_V3: null,
      created_at: now(),
      updated_at: now(),
    };
  }

  async getRecord(participantId, formalData) {
    const key = formalData ? this.formalKey(participantId) : this.practiceKey(participantId);
    const fallback = formalData ? this.defaultFormalRecord(participantId) : this.defaultPracticeRecord(participantId);
    return this.readJson(key, fallback);
  }

  getStudentRecord(record) {
    if (!record) return {};
    const common = {
      participant_id: record.participant_id,
      task: record.task,
      formal_data: record.formal_data,
      pre_ai_locked: Boolean(record.pre_ai_locked),
      pre_ai_locked_at: record.pre_ai_locked_at || null,
      final_decision_locked: Boolean(record.final_decision_locked),
      final_decision_locked_at: record.final_decision_locked_at || null,
    };
    if (!record.formal_data) {
      for (const field of PRACTICE_RECORD_FIELDS) common[field] = record[field] ?? '';
      return common;
    }
    const visible = [
      'V2_test_data', 'pre_ai_problem', 'pre_ai_evidence', 'pre_ai_revision_options',
      'pre_ai_preferred_revision', 'pre_ai_preference_reason', 'post_ai_problem',
      'post_ai_final_revision', 'post_ai_final_reason'
    ];
    for (const field of visible) common[field] = record[field] ?? '';
    return common;
  }

  async saveRecord(record) {
    record.updated_at = now();
    const key = record.formal_data ? this.formalKey(record.participant_id) : this.practiceKey(record.participant_id);
    return this.writeJson(key, record);
  }

  normalizeRecordPayload(payload = {}) {
    const output = { ...payload };
    for (const version of ['V1', 'V2', 'V3']) {
      const key = `${version}_test_data`;
      if (Object.prototype.hasOwnProperty.call(output, key)) output[key] = sanitizeTestData(output[key]);
    }
    return output;
  }

  async saveData(participantId, formalData, payload) {
    const record = await this.getRecord(participantId, formalData);
    const normalized = this.normalizeRecordPayload(payload);
    const dedicatedLockFields = new Set(formalData
      ? ['pre_ai_problem','pre_ai_evidence','pre_ai_revision_options','pre_ai_preferred_revision','pre_ai_preference_reason','post_ai_problem','post_ai_final_revision','post_ai_final_reason']
      : PRACTICE_RECORD_FIELDS);
    const allowedFields = new Set(formalData ? FORMAL_RECORD_FIELDS : []);

    for (const [key, value] of Object.entries(normalized)) {
      if (!allowedFields.has(key) || dedicatedLockFields.has(key)) continue;
      if (record.pre_ai_locked && ['V2_test_data'].includes(key)) {
        throw makeError('AI前记录已锁定，不能再修改V2测试数据', 409, 'pre_ai_locked');
      }
      record[key] = value;
    }
    return this.saveRecord(record);
  }

  async lockPreAi(participantId, formalData, payload) {
    const record = await this.getRecord(participantId, formalData);
    if (record.pre_ai_locked) throw makeError('AI前判断已经提交，不能再次修改', 409, 'pre_ai_locked');

    if (formalData) {
      const required = [
        'pre_ai_problem',
        'pre_ai_evidence',
        'pre_ai_revision_options',
        'pre_ai_preferred_revision',
        'pre_ai_preference_reason',
      ];
      for (const field of required) {
        if (!String(payload[field] || '').trim()) throw makeError('请先完成全部AI前判断', 400, 'missing_field', { field });
      }
      const testData = sanitizeTestData(payload.V2_test_data || record.V2_test_data);
      if (!testData || [testData.trial_1, testData.trial_2, testData.trial_3].some(v => v === null)) {
        throw makeError('请先填写3次V2真实测试时间', 400, 'missing_v2_test');
      }
      Object.assign(record, {
        V2_test_data: testData,
        pre_ai_problem: String(payload.pre_ai_problem).trim(),
        pre_ai_evidence: String(payload.pre_ai_evidence).trim(),
        pre_ai_revision_options: String(payload.pre_ai_revision_options).trim(),
        pre_ai_preferred_revision: String(payload.pre_ai_preferred_revision).trim(),
        pre_ai_preference_reason: String(payload.pre_ai_preference_reason).trim(),
      });
    } else {
      const required = ['practice_problem', 'practice_evidence', 'practice_initial_revision', 'practice_initial_reason'];
      for (const field of required) {
        if (!String(payload[field] || '').trim()) throw makeError('请先完成全部独立判断', 400, 'missing_field', { field });
      }
      for (const field of required) record[field] = String(payload[field]).trim();
    }

    record.pre_ai_locked = true;
    record.pre_ai_locked_at = now();
    return this.saveRecord(record);
  }

  async lockFinal(participantId, formalData, payload) {
    const record = await this.getRecord(participantId, formalData);
    if (!record.pre_ai_locked) throw makeError('请先提交AI前独立判断', 409, 'pre_ai_required');
    if (record.final_decision_locked) throw makeError('最终决定已经提交，不能再次修改', 409, 'final_decision_locked');

    if ((Number(record.ai_turn_count) || 0) < 1) throw makeError('请至少完成一次AI讨论后再提交最终决定', 409, 'ai_turn_required');

    if (formalData) {
      const required = ['post_ai_problem', 'post_ai_final_revision', 'post_ai_final_reason'];
      for (const field of required) {
        if (!String(payload[field] || '').trim()) throw makeError('请先完成全部最终判断', 400, 'missing_field', { field });
      }
      for (const field of required) record[field] = String(payload[field]).trim();
    } else {
      const required = ['practice_post_problem', 'practice_post_revision', 'practice_post_reason'];
      for (const field of required) {
        if (!String(payload[field] || '').trim()) throw makeError('请先完成AI后的再次判断', 400, 'missing_field', { field });
      }
      for (const field of required) record[field] = String(payload[field]).trim();
    }

    record.final_decision_locked = true;
    record.final_decision_locked_at = now();
    return this.saveRecord(record);
  }


  async adminPatchFormalRecord(participantId, payload = {}) {
    const record = await this.getRecord(participantId, true);
    const allowed = new Set([...FORMAL_RECORD_FIELDS, ...SCORE_FIELDS]);
    const normalized = this.normalizeRecordPayload(payload);
    for (const [key, value] of Object.entries(normalized)) {
      if (allowed.has(key)) record[key] = value;
    }
    return this.saveRecord(record);
  }

  async setPhoto(participantId, version, photoMeta) {
    if (!['V1', 'V2', 'V3'].includes(version)) throw makeError('版本无效', 400, 'invalid_version');
    const record = await this.getRecord(participantId, true);
    record[`${version}_photo`] = photoMeta;
    return this.saveRecord(record);
  }

  async getPhoto(participantId, version) {
    const record = await this.getRecord(participantId, true);
    return record[`${version}_photo`] || null;
  }

  async incrementAiTurn(participantId, formalData) {
    const record = await this.getRecord(participantId, formalData);
    record.ai_turn_count = (Number(record.ai_turn_count) || 0) + 1;
    record.last_ai_turn_at = now();
    return this.saveRecord(record);
  }

  conversationField(formalData) {
    return formalData ? 'formal_conversation_id' : 'practice_conversation_id';
  }

  contextSentField(formalData) {
    return formalData ? 'formal_context_sent' : 'practice_context_sent';
  }

  async getConversationInfo(participantId, formalData) {
    const record = await this.getRecord(participantId, formalData);
    return {
      conversation_id: record[this.conversationField(formalData)] || null,
      context_sent: Boolean(record[this.contextSentField(formalData)]),
    };
  }

  async setConversationInfo(participantId, formalData, conversationId, contextSent = true) {
    const record = await this.getRecord(participantId, formalData);
    record[this.conversationField(formalData)] = conversationId;
    if (contextSent) record[this.contextSentField(formalData)] = true;
    return this.saveRecord(record);
  }

  buildAiContext(formalData, state, record) {
    if (!formalData) {
      return [
        '【平台提供的练习背景｜请把这些内容当作学生已经提交并锁定的真实记录，不要要求学生重新填写】',
        SHOPPING_BAG_PRACTICE.evidence.join('\n'),
        `学生最初判断的问题：${record.practice_problem || ''}`,
        `判断依据：${record.practice_evidence || ''}`,
        `学生最初准备的修改：${record.practice_initial_revision || ''}`,
        `最初理由：${record.practice_initial_reason || ''}`,
      ].join('\n');
    }

    const test = record.V2_test_data || {};
    return [
      '【平台提供的已锁定背景｜这些是学生在AI出现前独立完成的真实记录。不要要求学生重复填写，也不要虚构数据。】',
      `任务目标：${PARACHUTE_BRIEF.goal}`,
      `设计标准：${PARACHUTE_BRIEF.criteria.join('；')}`,
      `限制条件：${PARACHUTE_BRIEF.constraints.join('；')}`,
      `共同学习过的知识：${PARACHUTE_BRIEF.shared_knowledge.join('；')}`,
      `V2测试：第1次 ${test.trial_1 ?? '未填'} s；第2次 ${test.trial_2 ?? '未填'} s；第3次 ${test.trial_3 ?? '未填'} s；平均 ${test.mean_descent_time ?? '未计算'} s。`,
      `V2行为观察：${test.notes || '无补充说明'}`,
      `学生AI前判断的问题：${record.pre_ai_problem || ''}`,
      `依据：${record.pre_ai_evidence || ''}`,
      `想到的修改方法：${record.pre_ai_revision_options || ''}`,
      `当前最倾向的修改：${record.pre_ai_preferred_revision || ''}`,
      `选择理由：${record.pre_ai_preference_reason || ''}`,
    ].join('\n');
  }

  scoreFields() {
    return SCORE_FIELDS;
  }
}

export const researchService = new ResearchService();
