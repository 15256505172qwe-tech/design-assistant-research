import { storageService } from './storageService.js';
import { DEFAULT_SETTINGS, CONDITIONS, PARACHUTE_CONTEXT, SHOPPING_BAG_CASE, SCHEMA_VERSION, PROMPT_VERSION, sharedTaskContext } from '../config/researchConfig.js';

const iso = () => new Date().toISOString();
const err = (message, status = 400, code = 'research_error') => Object.assign(new Error(message), { status, code });
const text = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
const bool = v => Boolean(v);
const nonneg = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const choose = (v, allowed, fallback = '') => allowed.includes(String(v || '')) ? String(v) : fallback;
const roundName = r => Number(r) === 2 ? 'round2' : 'round1';
const versionForEvidence = r => Number(r) === 2 ? 'V2' : 'V1';
const versionForRevision = r => Number(r) === 2 ? 'V3' : 'V2';

export function sanitizePerformance(payload = {}, repeatCount = 3) {
  const values = [nonneg(payload.test_1), nonneg(payload.test_2), nonneg(payload.test_3)];
  const used = values.slice(0, repeatCount);
  const mean = used.every(v => v !== null)
    ? Math.round((used.reduce((a,b)=>a+b,0) / used.length) * 1000) / 1000
    : null;
  return { test_1: values[0], test_2: values[1], test_3: repeatCount === 3 ? values[2] : null, mean_descent_time: mean };
}

export function sanitizeObservations(payload = {}) {
  return {
    opened: choose(payload.opened, ['yes','no','unsure']),
    sway: choose(payload.sway, ['none','some','strong']),
    rotation: choose(payload.rotation, ['none','some','strong']),
    drift: choose(payload.drift, ['none','some','strong']),
    stable_canopy: choose(payload.stable_canopy, ['yes','partial','no','unsure']),
    other_observation: text(payload.other_observation),
  };
}

class ResearchService {
  async readJson(key, fallback = null) {
    const raw = await storageService.getObject(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  async writeJson(key, value) { await storageService.putObject(key, JSON.stringify(value)); return value; }

  staticContent() { return { parachute: PARACHUTE_CONTEXT, practice: SHOPPING_BAG_CASE, schema_version: SCHEMA_VERSION }; }

  async getSettings() {
    const saved = await this.readJson('settings/system.json', {});
    // v8兼容：formal_open/ai_stage_open/v3_submission_open仅映射到新开关，不删除旧字段。
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      practice_open: saved.practice_open ?? DEFAULT_SETTINGS.practice_open,
      formal_round1_open: saved.formal_round1_open ?? saved.formal_open ?? DEFAULT_SETTINGS.formal_round1_open,
      formal_round2_open: saved.formal_round2_open ?? false,
      formal_round_count: Number(saved.formal_round_count) === 1 ? 1 : 2,
      test_repeat_count: Number(saved.test_repeat_count ?? saved.number_of_test_trials) === 2 ? 2 : 3,
      max_chat_minutes: Math.min(90, Math.max(1, Number(saved.max_chat_minutes) || 25)),
      enable_self_verification: saved.enable_self_verification === undefined ? true : Boolean(saved.enable_self_verification),
      schema_version: SCHEMA_VERSION,
    };
  }

  async saveSettings(patch = {}) {
    const current = await this.getSettings();
    const next = {
      ...current,
      practice_open: patch.practice_open === undefined ? current.practice_open : bool(patch.practice_open),
      formal_round1_open: patch.formal_round1_open === undefined ? current.formal_round1_open : bool(patch.formal_round1_open),
      formal_round2_open: patch.formal_round2_open === undefined ? current.formal_round2_open : bool(patch.formal_round2_open),
      formal_round_count: Number(patch.formal_round_count ?? current.formal_round_count) === 1 ? 1 : 2,
      max_chat_minutes: Math.min(90, Math.max(1, Number(patch.max_chat_minutes ?? current.max_chat_minutes) || 25)),
      test_repeat_count: Number(patch.test_repeat_count ?? current.test_repeat_count) === 2 ? 2 : 3,
      enable_self_verification: patch.enable_self_verification === undefined ? current.enable_self_verification : bool(patch.enable_self_verification),
      shared_rules_of_thumb: text(patch.shared_rules_of_thumb ?? current.shared_rules_of_thumb, 10000),
      schema_version: SCHEMA_VERSION,
      updated_at: iso(),
    };
    return this.writeJson('settings/system.json', next);
  }

  async audit(action, participantId, detail = {}) {
    const record = { action, participant_id: participantId || '', detail, created_at: iso() };
    await this.writeJson(`v9/audit-log/${Date.now()}_${Math.random().toString(36).slice(2,8)}.json`, record);
    return record;
  }

  async getParticipant(participantId) {
    const saved = await this.readJson(`students/${participantId}.json`, {});
    // v8兼容：旧group映射为新condition，但保留原字段。
    const mapped = saved.condition || (saved.group === 'structured' ? 'scaffold' : saved.group === 'autonomous' ? 'regular' : 'unassigned');
    const demo = /^DEMO-[SR]$/.test(participantId) || Boolean(saved.is_demo);
    const demoCondition = participantId === 'DEMO-S' ? 'scaffold' : participantId === 'DEMO-R' ? 'regular' : mapped;
    return {
      participant_id: participantId,
      student_id: participantId, // 只作旧代码兼容，正式导出使用participant_id。
      condition: CONDITIONS.includes(demoCondition) ? demoCondition : 'unassigned',
      grade: text(saved.grade, 40),
      is_demo: demo,
      created_at: saved.created_at || iso(),
      last_active_at: saved.last_active_at || null,
      condition_assigned_at: saved.condition_assigned_at || saved.group_assigned_at || null,
      legacy_group: saved.group || null,
      schema_version: SCHEMA_VERSION,
    };
  }

  async touchParticipant(participantId) {
    const p = await this.getParticipant(participantId);
    p.last_active_at = iso();
    await this.writeJson(`students/${participantId}.json`, p);
    return p;
  }
  async touchStudent(id) { return this.touchParticipant(id); }
  async getStudent(id) { return this.getParticipant(id); }

  async createParticipant(participantId, { condition = 'unassigned', grade = '', is_demo = false } = {}) {
    if (!CONDITIONS.includes(condition)) throw err('condition无效');
    const existing = await this.getParticipant(participantId);
    const p = { ...existing, participant_id: participantId, student_id: participantId, condition, grade: text(grade,40), is_demo: Boolean(is_demo || /^DEMO-[SR]$/.test(participantId)), created_at: existing.created_at || iso(), last_active_at: existing.last_active_at, condition_assigned_at: condition === 'unassigned' ? null : (existing.condition_assigned_at || iso()), schema_version: SCHEMA_VERSION };
    await this.writeJson(`students/${participantId}.json`, p);
    await this.audit('participant_upsert', participantId, { condition, grade: p.grade, is_demo: p.is_demo });
    return p;
  }

  async setCondition(participantId, { condition, grade } = {}, actor = 'admin', confirmAfterFormal = false) {
    if (!CONDITIONS.includes(condition)) throw err('condition无效');
    const p = await this.getParticipant(participantId);
    const started = (await this.getChatSession(participantId,'round1'))?.started_at || (await this.getChatSession(participantId,'round2'))?.started_at;
    if (started && p.condition !== condition && !confirmAfterFormal) throw err('该参与者已经进入正式AI，修改condition需要二次确认。',409,'condition_confirm_required');
    const before = p.condition;
    p.condition = condition;
    if (grade !== undefined) p.grade = text(grade,40);
    p.condition_assigned_at = condition === 'unassigned' ? null : iso();
    p.last_active_at = iso();
    await this.writeJson(`students/${participantId}.json`, p);
    await this.audit('condition_change', participantId, { from: before, to: condition, actor });
    return p;
  }

  async getPractice(participantId) {
    const old = await this.readJson(`v9/practice_sessions/${participantId}.json`, null);
    if (!old) return { participant_id: participantId, task_type:'practice', formal_data:false, before_locked:false, chat_completed:false, completed:false, created_at:iso(), updated_at:iso() };
    return { ...old, participant_id: old.participant_id || old.student_id || participantId, formal_data:false };
  }

  async lockPracticeBefore(participantId, payload = {}) {
    const r = await this.getPractice(participantId);
    if (r.before_locked) throw err('练习回答已经锁定，不能覆盖。',409);
    const revision = text(payload.practice_revision_idea ?? payload.practice_judgment_before);
    const evidence = text(payload.practice_evidence);
    if (!revision || !evidence) throw err('请完成两个练习问题');
    Object.assign(r,{ practice_revision_idea:revision, practice_evidence:evidence, before_locked:true, before_submitted_at:iso(), updated_at:iso() });
    await this.writeJson(`v9/practice_sessions/${participantId}.json`,r);
    return r;
  }

  async markPracticeChatComplete(participantId) {
    const r = await this.getPractice(participantId);
    r.chat_completed = true; r.chat_completed_at = iso(); r.completed = true; r.completed_at = iso(); r.updated_at = iso();
    return this.writeJson(`v9/practice_sessions/${participantId}.json`, r);
  }

  versionKey(participantId, version){ return `v9/prototype_tests/${participantId}/${version}.json`; }
  async getVersion(participantId, version){
    const v = await this.readJson(this.versionKey(participantId,version), null);
    if (!v) return null;
    // v8字段兼容：把扁平测试数据包入performance/observations，但不删除原数据。
    if (!v.performance && ('test_1' in v || 'mean_descent_time' in v)) v.performance = { test_1:v.test_1??null,test_2:v.test_2??null,test_3:v.test_3??null,mean_descent_time:v.mean_descent_time??v.P2_mean??null };
    if (!v.observations) v.observations = { opened:v.opened||'',sway:v.sway||'',rotation:v.rotation||'',drift:v.drift||'',stable_canopy:v.stable_canopy||'',other_observation:v.other_observation||'' };
    return { ...v, participant_id: v.participant_id || v.student_id || participantId, photos:Array.isArray(v.photos)?v.photos:[] };
  }

  async addPhoto(participantId, version, meta) {
    const current = await this.getVersion(participantId,version) || { participant_id:participantId,version,photos:[],created_at:iso(),schema_version:SCHEMA_VERSION };
    if ((current.photos||[]).length >= 3) throw err('每个版本最多上传3张照片',409);
    current.photos = [...(current.photos||[]), meta]; current.updated_at=iso();
    await this.writeJson(this.versionKey(participantId,version),current);
    return current.photos;
  }

  async canUploadVersion(participantId, version) {
    if (version === 'V1') return !(await this.getVersion(participantId,'V1'))?.evidence_locked;
    if (version === 'V2') return Boolean((await this.getFinal(participantId,1))?.locked) && !(await this.getRevision(participantId,1))?.locked;
    if (version === 'V3') return Boolean((await this.getFinal(participantId,2))?.locked) && !(await this.getRevision(participantId,2))?.locked;
    return false;
  }

  async saveEvidence(participantId, round, payload = {}) {
    round = Number(round) === 2 ? 2 : 1;
    if (round === 2) throw err('Round 2 的V2证据自动继承上一轮标准化复测，不能重复录入。',409);
    const settings = await this.getSettings();
    const version='V1';
    const current = await this.getVersion(participantId,version) || { participant_id:participantId,version,photos:[],created_at:iso(),schema_version:SCHEMA_VERSION };
    if (current.evidence_locked) throw err('V1证据已经锁定，不能覆盖。',409);
    if ((current.photos||[]).length < 1) throw err('请至少上传1张V1照片');
    const performance=sanitizePerformance(payload,settings.test_repeat_count);
    const required=[performance.test_1,performance.test_2].every(v=>v!==null) && (settings.test_repeat_count===2 || performance.test_3!==null);
    if(!required) throw err(`请填写${settings.test_repeat_count}次标准化测试时间`);
    Object.assign(current,{ performance, observations:sanitizeObservations(payload), evidence_locked:true, evidence_submitted_at:iso(), updated_at:iso() });
    await this.writeJson(this.versionKey(participantId,version),current);
    return current;
  }

  initialKey(id,r){return `v9/formal_rounds/${id}/${roundName(r)}_initial.json`;}
  finalKey(id,r){return `v9/formal_rounds/${id}/${roundName(r)}_final.json`;}
  alternativeKey(id,r){return `v9/formal_rounds/${id}/${roundName(r)}_alternative.json`;}
  revisionKey(id,r){return `v9/formal_rounds/${id}/${roundName(r)}_revision.json`;}
  selfKey(id,r){return `v9/formal_rounds/${id}/${roundName(r)}_self_verification.json`;}
  reflectionKey(id,r){return `v9/formal_rounds/${id}/${roundName(r)}_reflection.json`;}

  async getInitial(id,r){ return this.readJson(this.initialKey(id,r),null); }
  async lockInitial(id,r,payload={}){
    const round=Number(r)===2?2:1, evidence=await this.getVersion(id,versionForEvidence(round));
    if(round===1&&!evidence?.evidence_locked)throw err('请先完成V1测试证据。',409);
    if(round===2&&!evidence?.retest_locked)throw err('请先完成V2标准化复测。',409);
    const cur=await this.getInitial(id,round);if(cur?.locked)throw err('你的初始判断已经锁定，不能覆盖。',409);
    const initial_problem=text(payload.initial_problem),initial_evidence=text(payload.initial_evidence),initial_reason=text(payload.initial_reason);
    if(!initial_problem||!initial_evidence||!initial_reason)throw err('请完成三项初始判断');
    const out={participant_id:id,round,initial_problem,initial_evidence,initial_reason,locked:true,submitted_at:iso(),schema_version:SCHEMA_VERSION};
    return this.writeJson(this.initialKey(id,round),out);
  }

  async getFinal(id,r){ return this.readJson(this.finalKey(id,r),null); }
  async lockFinal(id,r,payload={}){
    const scope=Number(r)===2?'round2':'round1',chat=await this.getChatSession(id,scope);if(!chat?.locked)throw err('请先结束本轮AI讨论。',409);
    const cur=await this.getFinal(id,r);if(cur?.locked)throw err('最终作答已经锁定，不能覆盖。',409);
    const fields=['final_problem','final_evidence','final_reason','revision_decision','revision_reason'];
    const out={participant_id:id,round:Number(r),locked:true,submitted_at:iso(),schema_version:SCHEMA_VERSION};
    for(const k of fields){out[k]=text(payload[k]);if(!out[k])throw err('请完成全部最终作答');}
    return this.writeJson(this.finalKey(id,r),out);
  }

  async getAlternative(id,r){ return this.readJson(this.alternativeKey(id,r),null); }
  async saveAlternative(id,r,payload={}){
    const final=await this.getFinal(id,r);if(!final?.locked)throw err('请先锁定最终决定',409);
    const cur=await this.getAlternative(id,r);if(cur?.locked)throw err('这条事实记录已经提交，不能覆盖。',409);
    const considered=choose(payload.alternative_considered,['yes','no']);if(!considered)throw err('请选择是否考虑过其他修改办法');
    const out={participant_id:id,round:Number(r),alternative_considered:considered,alternative_text:considered==='yes'?text(payload.alternative_text):'',alternative_reject_reason:considered==='yes'?text(payload.alternative_reject_reason):'',locked:true,submitted_at:iso(),schema_version:SCHEMA_VERSION};
    if(considered==='yes'&&(!out.alternative_text||!out.alternative_reject_reason))throw err('请补充你还考虑过什么，以及为什么没有选择它');
    return this.writeJson(this.alternativeKey(id,r),out);
  }

  async getRevision(id,r){ return this.readJson(this.revisionKey(id,r),null); }
  async saveRevision(id,r,payload={}){
    const final=await this.getFinal(id,r);if(!final?.locked)throw err('请先完成最终决定',409);
    const cur=await this.getRevision(id,r);if(cur?.locked)throw err('实际修改记录已经锁定，不能覆盖。',409);
    const version=versionForRevision(r),v=await this.getVersion(id,version);
    if(!v || (v.photos||[]).length<1)throw err(`请至少上传1张${version}照片`);
    const actual_revision=text(payload.actual_revision);if(!actual_revision)throw err('请填写你实际改了哪些地方');
    const out={participant_id:id,round:Number(r),new_version:version,actual_revision,revision_difference:text(payload.revision_difference),locked:true,submitted_at:iso(),schema_version:SCHEMA_VERSION};
    await this.writeJson(this.revisionKey(id,r),out);
    v.actual_revision=actual_revision;v.revision_difference=out.revision_difference;v.revision_locked=true;v.revision_submitted_at=out.submitted_at;v.updated_at=iso();await this.writeJson(this.versionKey(id,version),v);
    return out;
  }

  async getSelfVerification(id,r){ return this.readJson(this.selfKey(id,r),null); }
  async saveSelfVerification(id,r,payload={}){
    const settings=await this.getSettings();if(!settings.enable_self_verification)return {disabled:true};
    if(!(await this.getRevision(id,r))?.locked)throw err('请先完成实际修改记录。',409);
    const cur=await this.getSelfVerification(id,r);if(cur?.locked)throw err('自主试验记录已经提交，不能覆盖。',409);
    const tried=choose(payload.self_tried,['yes','no']);if(!tried)throw err('请选择你有没有自己先试一试');
    const out={participant_id:id,round:Number(r),self_tried:tried,self_goal:tried==='yes'?text(payload.self_goal):'',self_method:tried==='yes'?text(payload.self_method):'',self_result:tried==='yes'?text(payload.self_result):'',locked:true,submitted_at:iso(),schema_version:SCHEMA_VERSION};
    if(tried==='yes'&&(!out.self_goal||!out.self_method||!out.self_result))throw err('请补充你想确认什么、怎么试、结果怎样');
    return this.writeJson(this.selfKey(id,r),out);
  }

  async saveRetest(id,r,payload={}){
    const settings=await this.getSettings(),version=versionForRevision(r),revision=await this.getRevision(id,r);
    if(!revision?.locked)throw err('请先完成实际修改记录',409);
    const current=await this.getVersion(id,version);if(!current)throw err(`${version}记录不存在`);
    if(current.retest_locked)throw err(`${version}标准化复测已经锁定，不能覆盖。`,409);
    const performance=sanitizePerformance(payload,settings.test_repeat_count);
    const required=[performance.test_1,performance.test_2].every(v=>v!==null)&&(settings.test_repeat_count===2||performance.test_3!==null);if(!required)throw err(`请填写${settings.test_repeat_count}次标准化测试时间`);
    Object.assign(current,{performance,observations:sanitizeObservations(payload),retest_locked:true,retest_submitted_at:iso(),updated_at:iso()});
    return this.writeJson(this.versionKey(id,version),current);
  }

  async getReflection(id,r){ return this.readJson(this.reflectionKey(id,r),null); }
  async saveReflection(id,r,payload={}){
    const round=Number(r)===2?2:1,version=versionForRevision(round),v=await this.getVersion(id,version);if(!v?.retest_locked)throw err('请先完成本轮标准化复测。',409);
    const cur=await this.getReflection(id,round);if(cur?.locked)throw err('本轮反思已经提交，不能覆盖。',409);
    let out;
    if(round===1){
      out={participant_id:id,round,reflection_match:choose(payload.reflection_match,['yes','partial','no']),reflection_note:text(payload.reflection_note),locked:true,submitted_at:iso(),schema_version:SCHEMA_VERSION};
      if(!out.reflection_match)throw err('请选择复测结果是否与预想一致');
    }else{
      out={participant_id:id,round,reflection_match:choose(payload.reflection_match,['yes','partial','no']),reflection_evidence:text(payload.reflection_evidence),reflection_reconsider:text(payload.reflection_reconsider),locked:true,submitted_at:iso(),schema_version:SCHEMA_VERSION};
      if(!out.reflection_match||!out.reflection_evidence||!out.reflection_reconsider)throw err('请完成最终反思');
    }
    return this.writeJson(this.reflectionKey(id,r),out);
  }

  async getChatSession(id,scope){ return this.readJson(`v9/chat_sessions/${id}/${scope}.json`,null); }
  async saveChatSession(id,scope,session){ return this.writeJson(`v9/chat_sessions/${id}/${scope}.json`,session); }
  async ensureChatSession(id,scope,{condition='regular',bot_id='',prompt_version=PROMPT_VERSION,model='configured-in-coze'}={}){
    let s=await this.getChatSession(id,scope);if(s)return s;
    s={participant_id:id,scope,session_id:`${scope}_${id}_${Date.now()}`,condition,bot_id,prompt_version,model,conversation_id:'',started_at:null,ended_at:null,chat_duration_seconds:null,user_turn_count:0,assistant_turn_count:0,opening_sent:false,locked:false,schema_version:SCHEMA_VERSION};
    return this.saveChatSession(id,scope,s);
  }
  async appendMessage(id,scope,message){
    const list=await storageService.listObjects(`v9/chat_messages/${id}/${scope}/`);const index=list.length+1;
    const record={participant_id:id,scope,message_index:index,...message,created_at:message.created_at||iso()};
    await this.writeJson(`v9/chat_messages/${id}/${scope}/${String(index).padStart(4,'0')}.json`,record);return record;
  }
  async getMessages(id,scope){
    const list=await storageService.listObjects(`v9/chat_messages/${id}/${scope}/`);const rows=[];for(const x of list.sort((a,b)=>a.key.localeCompare(b.key))){const r=await this.readJson(x.key,null);if(r)rows.push(r);}return rows;
  }
  async endChat(id,scope){
    const s=await this.getChatSession(id,scope);if(!s)return null;if(!s.started_at)s.started_at=iso();if(!s.ended_at)s.ended_at=iso();s.locked=true;s.chat_duration_seconds=Math.max(0,Math.floor((Date.parse(s.ended_at)-Date.parse(s.started_at))/1000));await this.saveChatSession(id,scope,s);if(scope==='practice')await this.markPracticeChatComplete(id);return s;
  }

  async getRoundData(id,r){
    const round=Number(r)===2?2:1, evidence=await this.getVersion(id,versionForEvidence(round));
    return {round,evidence,initial:await this.getInitial(id,round),chat_session:await this.getChatSession(id,roundName(round)),chat:await this.getMessages(id,roundName(round)),final:await this.getFinal(id,round),alternative:await this.getAlternative(id,round),revision:await this.getRevision(id,round),self_verification:await this.getSelfVerification(id,round),new_version:await this.getVersion(id,versionForRevision(round)),reflection:await this.getReflection(id,round)};
  }

  async getFormalStage(id){
    const settings=await this.getSettings();
    if(!settings.formal_round1_open)return {stage:'round1_waiting',round:1,open:false};
    const v1=await this.getVersion(id,'V1');if(!v1?.evidence_locked)return {stage:'round1_evidence',round:1,open:true};
    if(!(await this.getInitial(id,1))?.locked)return {stage:'round1_initial',round:1,open:true};
    if(!(await this.getChatSession(id,'round1'))?.locked)return {stage:'round1_chat',round:1,open:true};
    if(!(await this.getFinal(id,1))?.locked)return {stage:'round1_final',round:1,open:true};
    if(!(await this.getAlternative(id,1))?.locked)return {stage:'round1_alternative',round:1,open:true};
    if(!(await this.getRevision(id,1))?.locked)return {stage:'round1_revision',round:1,open:true};
    if(settings.enable_self_verification && !(await this.getSelfVerification(id,1))?.locked)return {stage:'round1_self_verification',round:1,open:true};
    if(!(await this.getVersion(id,'V2'))?.retest_locked)return {stage:'round1_retest',round:1,open:true};
    if(!(await this.getReflection(id,1))?.locked)return {stage:'round1_reflection',round:1,open:true};
    if(settings.formal_round_count===1)return {stage:'complete',round:1,open:true};
    if(!settings.formal_round2_open)return {stage:'round2_waiting',round:2,open:false};
    if(!(await this.getInitial(id,2))?.locked)return {stage:'round2_initial',round:2,open:true};
    if(!(await this.getChatSession(id,'round2'))?.locked)return {stage:'round2_chat',round:2,open:true};
    if(!(await this.getFinal(id,2))?.locked)return {stage:'round2_final',round:2,open:true};
    if(!(await this.getAlternative(id,2))?.locked)return {stage:'round2_alternative',round:2,open:true};
    if(!(await this.getRevision(id,2))?.locked)return {stage:'round2_revision',round:2,open:true};
    if(settings.enable_self_verification && !(await this.getSelfVerification(id,2))?.locked)return {stage:'round2_self_verification',round:2,open:true};
    if(!(await this.getVersion(id,'V3'))?.retest_locked)return {stage:'round2_retest',round:2,open:true};
    if(!(await this.getReflection(id,2))?.locked)return {stage:'round2_reflection',round:2,open:true};
    return {stage:'complete',round:2,open:true};
  }

  async getStudentState(id){
    const [participant,practice,settings,formal]=await Promise.all([this.getParticipant(id),this.getPractice(id),this.getSettings(),this.getFormalStage(id)]);
    return {participant_id:id,practice_open:settings.practice_open,practice_completed:Boolean(practice.completed),formal_round_count:settings.formal_round_count,formal_round1_open:settings.formal_round1_open,formal_round2_open:settings.formal_round2_open,formal_stage:formal.stage,current_round:formal.round,condition_assigned:participant.condition!=='unassigned',is_demo:participant.is_demo};
  }

  async formalChatAccess(id,round){
    const participant=await this.getParticipant(id),settings=await this.getSettings(),stage=await this.getFormalStage(id);
    round=Number(round)===2?2:1;
    if(participant.condition==='unassigned')return {eligible:false,reason:'正式AI条件尚未由老师设置，请根据老师安排继续课堂活动。'};
    if(round===1&&!settings.formal_round1_open)return {eligible:false,reason:'这一部分还没有开放，请根据老师安排继续课堂活动。'};
    if(round===2&&(settings.formal_round_count!==2||!settings.formal_round2_open))return {eligible:false,reason:'第二轮还没有开放，请根据老师安排继续课堂活动。'};
    const initial=await this.getInitial(id,round);if(!initial?.locked)return {eligible:false,reason:'请先完成并锁定自己的初始判断。'};
    return {eligible:true,condition:participant.condition,scope:roundName(round),settings,stage};
  }

  async contextForChat(id,scope){
    const settings=await this.getSettings();
    if(scope==='practice'){
      const p=await this.getPractice(id);
      return [
        '这是所有学生都相同的Shopping Bag平台练习。不要使用结构化支架，不要要求学生列多个方案、比较优缺点、解释为什么不选另一个方案或设计验证步骤。自然帮助学生熟悉聊天即可。',
        `案例：${SHOPPING_BAG_CASE.background}`,
        `学生准备怎么改：${p.practice_revision_idea||''}`,
        `学生依据：${p.practice_evidence||''}`,
        '请主动开始一段简短、自然的讨论。不要替学生写正式实验答案。',
      ].join('\n\n');
    }
    const round=scope==='round2'?2:1,evidence=await this.getVersion(id,versionForEvidence(round)),initial=await this.getInitial(id,round);
    return [
      sharedTaskContext(settings),
      `【当前版本】${versionForEvidence(round)}`,
      `【当前版本测试证据】\n${JSON.stringify({photos:(evidence?.photos||[]).map(x=>x.file_name),performance:evidence?.performance||{},observations:evidence?.observations||{}},null,2)}`,
      `【学生在AI前已经锁定的判断】\n问题：${initial?.initial_problem||''}\n依据：${initial?.initial_evidence||''}\n原因：${initial?.initial_reason||''}`,
      '请直接根据上述材料主动开始讨论，不要让学生重新抄写证据。学生最终决定必须由学生自己填写，不能替学生自动生成最终答案。若学生明确表示不会或卡住，可以先给简短解释、句式支持或少量方向，但不要因为平台逻辑强迫所有学生列多个方案。',
    ].join('\n\n');
  }

  async getLegacyV8Data(id){
    const messageBlobs = await storageService.listObjects(`chat_messages/${id}/formal/`);
    const oldMessages = [];
    for (const x of messageBlobs.sort((a,b)=>a.key.localeCompare(b.key))) { const r = await this.readJson(x.key,null); if (r) oldMessages.push(r); }
    return {
      old_practice: await this.readJson(`practice_sessions/${id}.json`,null),
      v2_formal: await this.readJson(`prototype_tests/${id}/V2.json`,null),
      old_v3: await this.readJson(`prototype_tests/${id}/V3.json`,null),
      old_judgment_before: await this.readJson(`judgments/${id}/before.json`,null),
      old_decision_after: await this.readJson(`decisions/${id}/after.json`,null),
      old_reflection: await this.readJson(`reflections/${id}/V3.json`,null),
      old_formal_chat: await this.readJson(`chat_sessions/${id}/formal.json`,null),
      old_formal_messages: oldMessages,
    };
  }

  async getCompleteParticipantData(id){
    const participant=await this.getParticipant(id),settings=await this.getSettings();
    return {schema_version:SCHEMA_VERSION,participant,settings_snapshot:{formal_round_count:settings.formal_round_count,test_repeat_count:settings.test_repeat_count,enable_self_verification:settings.enable_self_verification},practice:await this.getPractice(id),round1:await this.getRoundData(id,1),round2:await this.getRoundData(id,2),legacy_v8:await this.getLegacyV8Data(id)};
  }
  async getCompleteStudentData(id){ return this.getCompleteParticipantData(id); }
}

export const researchService = new ResearchService();
