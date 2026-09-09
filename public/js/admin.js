const $ = id => document.getElementById(id);
let currentParticipant = null;
let currentDetail = null;

async function api(url, options = {}) {
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data;
}

async function adminLogin() {
  $('loginError').style.display = 'none';
  try {
    await api('/express/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('adminPassword').value }) });
    await showAdmin();
  } catch (err) {
    $('loginError').textContent = err.message;
    $('loginError').style.display = 'block';
  }
}

async function showAdmin() {
  $('loginOverlay').style.display = 'none';
  $('adminContent').hidden = false;
  await Promise.all([loadStage(), loadParticipants()]);
}

async function initialize() {
  try {
    await api('/express/api/admin/participants');
    await showAdmin();
  } catch (_) {
    $('loginOverlay').style.display = 'grid';
  }
}

async function loadStage() {
  const data = await api('/express/api/admin/course-stage');
  const select = $('courseStage'); select.innerHTML = '';
  data.options.forEach(option => {
    const el = document.createElement('option');
    el.value = option.value; el.textContent = option.label;
    el.selected = data.current.current_stage === option.value;
    select.appendChild(el);
  });
}

async function loadParticipants() {
  const list = await api('/express/api/admin/participants');
  const container = $('participantList'); container.innerHTML = '';
  list.forEach(p => {
    const item = document.createElement('div');
    item.className = `participant-item${currentParticipant === p.participant_id ? ' active' : ''}`;
    const group = p.group || '未分组';
    item.innerHTML = `<div class="participant-row"><span class="pid">${p.participant_id}</span><span class="badge">${group}</span></div><div class="meta">自主轮资料 ${p.baseline_ready ? '✓' : '—'} · AI前锁定 ${p.pre_ai_locked ? '✓' : '—'} · 最终决定 ${p.final_decision_locked ? '✓' : '—'}</div>`;
    item.addEventListener('click', () => loadDetail(p.participant_id));
    container.appendChild(item);
  });
}

function textField(name, label, value = '', rows = 3) {
  return `<div class="admin-field"><label>${label}</label><textarea data-field="${name}" rows="${rows}">${escapeHtml(value ?? '')}</textarea></div>`;
}
function inputField(name, label, value = '', type = 'text', step = '') {
  return `<div class="admin-field"><label>${label}</label><input data-field="${name}" type="${type}" value="${escapeAttr(value ?? '')}" ${step ? `step="${step}"` : ''}></div>`;
}
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(v) { return escapeHtml(v); }

function testBlock(version, data = {}) {
  return `<h4>${version} 标准化测试</h4><div class="field-grid three">${inputField(`${version}_trial_1`,'第1次（秒）',data.trial_1,'number','0.01')}${inputField(`${version}_trial_2`,'第2次（秒）',data.trial_2,'number','0.01')}${inputField(`${version}_trial_3`,'第3次（秒）',data.trial_3,'number','0.01')}</div>${textField(`${version}_test_notes`,'功能/稳定性观察',data.notes || '',2)}`;
}

function photoBlock(version, record) {
  const exists = Boolean(record[`${version}_photo`]?.path);
  return `<div class="photo-row"><strong>${version}照片</strong><span class="photo-status">${exists ? '已上传' : '暂无'}</span><label class="admin-btn secondary" style="font-size:11px;padding:6px 9px">上传/替换<input type="file" data-photo-version="${version}" accept="image/jpeg,image/png,image/webp" hidden></label></div>`;
}

async function loadDetail(participantId) {
  currentParticipant = participantId;
  await loadParticipants();
  currentDetail = await api(`/express/api/admin/participant/${encodeURIComponent(participantId)}`);
  const r = currentDetail.formal_record || {};
  $('detailTitle').textContent = `${participantId} · 完整研究证据链`;
  const detail = $('detail');
  detail.innerHTML = `
    <div class="section"><h3>分组</h3><div class="field-grid"><div class="admin-field"><label>正式AI条件</label><select id="groupSelect"><option value="">未分组</option><option value="structured" ${currentDetail.profile.group==='structured'?'selected':''}>structured</option><option value="autonomous" ${currentDetail.profile.group==='autonomous'?'selected':''}>autonomous</option></select></div><div style="align-self:end"><button class="admin-btn" id="saveGroup">保存分组</button></div></div><p class="meta">编号保持P01等中性形式。正式AI阶段未分组时学生会被阻止进入。</p></div>

    <div class="section"><h3>V1 → V2 无AI自主迭代</h3>${photoBlock('V1',r)}${testBlock('V1',r.V1_test_data||{})}${textField('V1_problem','V1测试后：最需要解决的问题',r.V1_problem)}${textField('V1_problem_evidence','判断依据',r.V1_problem_evidence)}${textField('V1_revision_options','想到的修改方法',r.V1_revision_options)}${textField('V1_selected_revision','最终选择的自主修改',r.V1_selected_revision)}${textField('V1_selection_reason','自主选择理由',r.V1_selection_reason)}${textField('actual_modification_v1_v2','V1→V2 实际改了什么',r.actual_modification_v1_v2)}${photoBlock('V2',r)}${testBlock('V2',r.V2_test_data||{})}${textField('V2_reflection','V2复测反思（I0证据）',r.V2_reflection)}</div>

    <div class="section"><h3>唯一一次正式AI：V2 → V3</h3><h4>AI前独立记录（锁定）</h4>${textField('pre_ai_problem','主要问题',r.pre_ai_problem)}${textField('pre_ai_evidence','测试依据',r.pre_ai_evidence)}${textField('pre_ai_revision_options','可能的修改方法',r.pre_ai_revision_options)}${textField('pre_ai_preferred_revision','AI前最倾向的修改',r.pre_ai_preferred_revision)}${textField('pre_ai_preference_reason','AI前选择理由',r.pre_ai_preference_reason)}<h4>AI后最终决定（锁定）</h4>${textField('post_ai_problem','AI后主要问题/原因',r.post_ai_problem)}${textField('post_ai_final_revision','最终决定怎么改',r.post_ai_final_revision)}${textField('post_ai_final_reason','最终理由/方案取舍',r.post_ai_final_reason)}${textField('actual_modification_v2_v3','V2→V3 实际改了什么',r.actual_modification_v2_v3)}${photoBlock('V3',r)}${testBlock('V3',r.V3_test_data||{})}${textField('V3_reflection','V3复测反思（I1证据）',r.V3_reflection)}</div>

    <div class="section"><h3>人工评分（学生端不可见）</h3><div class="scores">${['G0','E0','H0','I0','G1','E1','H1','I1','Q_V1','Q_V2','Q_V3'].map(k=>inputField(k,k,r[k],'number','0.1')).join('')}</div><p class="meta">平台不自动计算GEHI、Q或综合总分；由研究者依据冻结后的评分手册人工录入。</p></div>

    <div class="section"><h3>课外AI污染核查与访谈</h3><div class="field-grid"><div class="admin-field"><label>课外其他AI</label><select data-field="external_ai_use"><option value="" ${!r.external_ai_use?'selected':''}>未记录</option><option value="none" ${r.external_ai_use==='none'?'selected':''}>没有</option><option value="yes" ${r.external_ai_use==='yes'?'selected':''}>有</option></select></div><div class="admin-field"><label>次数</label><select data-field="external_ai_frequency"><option value=""></option><option value="1" ${r.external_ai_frequency==='1'?'selected':''}>1次</option><option value="2-3" ${r.external_ai_frequency==='2-3'?'selected':''}>2–3次</option><option value="4+" ${r.external_ai_frequency==='4+'?'selected':''}>4次及以上</option></select></div><div class="admin-field"><label>是否改变设计</label><select data-field="external_ai_changed_design"><option value=""></option><option value="no" ${r.external_ai_changed_design==='no'?'selected':''}>没有</option><option value="a_little" ${r.external_ai_changed_design==='a_little'?'selected':''}>有一点</option><option value="clearly" ${r.external_ai_changed_design==='clearly'?'selected':''}>明显改变</option></select></div><div class="admin-field"><label>访谈选中</label><select data-field="interview_selected"><option value="false" ${!r.interview_selected?'selected':''}>否</option><option value="true" ${r.interview_selected?'selected':''}>是</option></select></div>${inputField('interview_status','访谈状态',r.interview_status)}${inputField('interview_date','访谈日期',r.interview_date,'date')}</div>${textField('interview_notes','访谈备注',r.interview_notes,4)}</div>

    <div class="section"><h3>正式AI聊天日志</h3><div id="logList"></div></div>
    <div class="save-row"><button class="admin-btn" id="saveResearch">保存全部研究资料</button></div>`;

  $('saveGroup').addEventListener('click', saveGroup);
  $('saveResearch').addEventListener('click', saveResearch);
  detail.querySelectorAll('[data-photo-version]').forEach(input => input.addEventListener('change', uploadPhoto));
  renderLogs(currentDetail.logs || []);
}

function renderLogs(logs) {
  const container = $('logList'); container.innerHTML = '';
  const formal = logs.filter(log => log.formal_data === true);
  if (!formal.length) { container.innerHTML = '<div class="meta">暂无正式AI聊天记录。</div>'; return; }
  formal.forEach(log => {
    const div = document.createElement('div'); div.className = 'log-item';
    div.innerHTML = `<strong>学生：</strong>${escapeHtml(log.user_message||'')}<br><strong>AI：</strong>${escapeHtml(log.assistant_message||'')}<div class="meta">${escapeHtml(log.send_time||'')} · ${escapeHtml(log.mode||'')} · ${escapeHtml(log.status||'')}</div>`;
    container.appendChild(div);
  });
}

async function saveGroup() {
  const group = $('groupSelect').value;
  if (!group) return window.alert('请选择 structured 或 autonomous。');
  try { await api(`/express/api/admin/participant/${encodeURIComponent(currentParticipant)}/group`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({group}) }); await loadDetail(currentParticipant); }
  catch (err) { window.alert(err.message); }
}

function collectTest(version) {
  const root = $('detail');
  const val = name => root.querySelector(`[data-field="${name}"]`)?.value || '';
  const t = { trial_1: val(`${version}_trial_1`), trial_2: val(`${version}_trial_2`), trial_3: val(`${version}_trial_3`), notes: val(`${version}_test_notes`) };
  return Object.values(t).some(Boolean) ? t : null;
}

async function saveResearch() {
  const data = {};
  $('detail').querySelectorAll('[data-field]').forEach(el => {
    const name = el.dataset.field;
    if (name.includes('_trial_') || name.endsWith('_test_notes')) return;
    let value = el.value;
    if (name === 'interview_selected') value = value === 'true';
    if (['G0','E0','H0','I0','G1','E1','H1','I1','Q_V1','Q_V2','Q_V3'].includes(name)) value = value === '' ? null : Number(value);
    data[name] = value;
  });
  for (const version of ['V1','V2','V3']) {
    const test = collectTest(version); if (test) data[`${version}_test_data`] = test;
  }
  try {
    await api(`/express/api/admin/participant/${encodeURIComponent(currentParticipant)}/research`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data}) });
    window.alert('研究资料已保存。');
    await loadDetail(currentParticipant);
  } catch (err) { window.alert(err.message); }
}

async function uploadPhoto(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const version = event.target.dataset.photoVersion;
  const formData = new FormData(); formData.append('image',file); formData.append('participantId',currentParticipant); formData.append('version',version);
  try { await api('/express/api/research/photo', { method:'POST', body:formData }); window.alert(`${version}照片已保存。`); await loadDetail(currentParticipant); }
  catch (err) { window.alert(err.message); }
}

$('saveStage').addEventListener('click', async () => {
  const current_stage = $('courseStage').value;
  if (!window.confirm(`确定切换课程阶段吗？\n${$('courseStage').selectedOptions[0].textContent}`)) return;
  try { await api('/express/api/admin/course-stage', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({current_stage}) }); window.alert('课程阶段已切换。'); await loadStage(); }
  catch (err) { window.alert(err.message); }
});
$('adminLoginBtn').addEventListener('click', adminLogin);
$('adminPassword').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
$('logoutBtn').addEventListener('click', async () => { await fetch('/express/api/admin/logout',{method:'POST'}); location.reload(); });
$('exportResearch').addEventListener('click', () => window.open('/express/api/admin/export-research-csv','_blank'));
$('exportChat').addEventListener('click', () => window.open('/express/api/admin/export-chat-jsonl','_blank'));
$('exportInterview').addEventListener('click', () => window.open('/express/api/admin/export-interviews-csv','_blank'));

initialize();
