const participantId = sessionStorage.getItem('participantId');
const sessionId = sessionStorage.getItem('sessionId');
if (!participantId || !sessionId) window.location.href = '/';

const $ = id => document.getElementById(id);
const state = { research: null, record: null, content: null, currentImageId: null, isLoading: false, isImageUploading: false };

$('headerUser').textContent = participantId || '';

function showError(message) {
  window.alert(message || '操作失败，请重试。');
}

function field(form, name) {
  return form.elements.namedItem(name);
}

function setField(form, name, value) {
  const el = field(form, name);
  if (el && value !== undefined && value !== null) el.value = value;
}

function escapeText(value) {
  return String(value ?? '');
}

function renderList(container, items = []) {
  container.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    container.appendChild(li);
  });
}

async function loadResearchState() {
  const res = await fetch(`/express/api/research/state?participantId=${encodeURIComponent(participantId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '无法读取当前课程阶段');
  state.research = data;
  state.record = data.record || {};
  state.content = data.content || {};
  $('headerStage').textContent = data.stage_label || data.current_stage;
  return data;
}

function renderNonAiStage() {
  $('researchLayout').hidden = true;
  $('stageOnly').hidden = false;
  $('stageOnlyTitle').textContent = state.research.stage_label || '当前阶段无需使用AI';
  $('stageOnlyText').textContent = '这一阶段不需要使用AI。请按老师的课堂安排完成制作、测试或整理；已有平台记录不会丢失。';
}

function renderPractice() {
  $('researchLayout').hidden = false;
  $('stageOnly').hidden = true;
  $('taskEyebrow').textContent = '第1课 · Practice';
  $('taskTitle').textContent = state.content.practice?.title || 'Shopping Bag 失败案例';
  $('taskGoal').textContent = '先自己看证据、作判断，再和普通AI讨论，最后仍由你自己决定。练习记录不进入正式效果统计。';
  $('practiceEvidence').hidden = false;
  const ul = document.createElement('ul');
  (state.content.practice?.evidence || []).forEach(text => { const li = document.createElement('li'); li.textContent = text; ul.appendChild(li); });
  $('practiceEvidence').innerHTML = '<div class="section-label">案例证据</div>';
  $('practiceEvidence').appendChild(ul);
  $('formalEvidence').hidden = true;
  $('practicePreFields').hidden = false;
  $('formalPreFields').hidden = true;
  $('practiceFinalFields').hidden = false;
  $('formalFinalFields').hidden = true;

  const r = state.record;
  setField($('preAiForm'), 'practice_problem', r.practice_problem);
  setField($('preAiForm'), 'practice_evidence', r.practice_evidence);
  setField($('preAiForm'), 'practice_initial_revision', r.practice_initial_revision);
  setField($('preAiForm'), 'practice_initial_reason', r.practice_initial_reason);
  setField($('finalForm'), 'practice_post_problem', r.practice_post_problem);
  setField($('finalForm'), 'practice_post_revision', r.practice_post_revision);
  setField($('finalForm'), 'practice_post_reason', r.practice_post_reason);
}

function renderFormal() {
  $('researchLayout').hidden = false;
  $('stageOnly').hidden = true;
  $('taskEyebrow').textContent = '正式任务 · V2 → V3';
  $('taskTitle').textContent = state.content.parachute?.title || 'Model Parachute';
  $('taskGoal').textContent = '先根据V2真实测试证据独立判断，再使用AI；AI讨论后由你自己形成最终修改决定。';
  $('practiceEvidence').hidden = true;
  $('formalEvidence').hidden = false;
  $('formalGoal').textContent = state.content.parachute?.goal || '';
  renderList($('formalCriteria'), state.content.parachute?.criteria || []);
  $('practicePreFields').hidden = true;
  $('formalPreFields').hidden = false;
  $('practiceFinalFields').hidden = true;
  $('formalFinalFields').hidden = false;

  const r = state.record;
  const t = r.V2_test_data || {};
  setField($('preAiForm'), 'trial_1', t.trial_1);
  setField($('preAiForm'), 'trial_2', t.trial_2);
  setField($('preAiForm'), 'trial_3', t.trial_3);
  setField($('preAiForm'), 'test_notes', t.notes);
  setField($('preAiForm'), 'pre_ai_problem', r.pre_ai_problem);
  setField($('preAiForm'), 'pre_ai_evidence', r.pre_ai_evidence);
  setField($('preAiForm'), 'pre_ai_revision_options', r.pre_ai_revision_options);
  setField($('preAiForm'), 'pre_ai_preferred_revision', r.pre_ai_preferred_revision);
  setField($('preAiForm'), 'pre_ai_preference_reason', r.pre_ai_preference_reason);
  setField($('finalForm'), 'post_ai_problem', r.post_ai_problem);
  setField($('finalForm'), 'post_ai_final_revision', r.post_ai_final_revision);
  setField($('finalForm'), 'post_ai_final_reason', r.post_ai_final_reason);
  refreshV2Photo();
}

async function refreshV2Photo() {
  if (!state.research?.formal_data) return;
  const img = $('v2Photo');
  try {
    const res = await fetch(`/express/api/research/photo/${encodeURIComponent(participantId)}/V2`, { cache: 'no-store' });
    if (!res.ok) throw new Error('no photo');
    const blob = await res.blob();
    img.src = URL.createObjectURL(blob);
    img.hidden = false;
    $('v2PhotoEmpty').hidden = true;
  } catch (_) {
    img.hidden = true;
    $('v2PhotoEmpty').hidden = false;
  }
}

function renderLockedSummary() {
  const r = state.record;
  const box = $('lockedSummary');
  box.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'section-label';
  title.textContent = '我的独立判断 · 已锁定';
  box.appendChild(title);
  const dl = document.createElement('dl');
  const items = state.research.formal_data
    ? [
        ['V2测试', r.V2_test_data ? `${r.V2_test_data.trial_1}s / ${r.V2_test_data.trial_2}s / ${r.V2_test_data.trial_3}s（平均 ${r.V2_test_data.mean_descent_time ?? '-'}s）` : ''],
        ['最需要解决的问题', r.pre_ai_problem],
        ['判断依据', r.pre_ai_evidence],
        ['想到的修改方法', r.pre_ai_revision_options],
        ['当前倾向', r.pre_ai_preferred_revision],
        ['选择理由', r.pre_ai_preference_reason],
      ]
    : [
        ['主要问题', r.practice_problem],
        ['判断依据', r.practice_evidence],
        ['准备怎么改', r.practice_initial_revision],
        ['为什么', r.practice_initial_reason],
      ];
  items.forEach(([label, value]) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = escapeText(value);
    dl.append(dt, dd);
  });
  box.appendChild(dl);
  box.hidden = false;
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}-message`;
  if (role === 'assistant') {
    const mark = document.createElement('div');
    mark.className = 'assistant-mark';
    mark.innerHTML = '<svg viewBox="0 0 52 52" fill="none"><path d="M11 35 25 21l9 8 8-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11" cy="35" r="3" fill="currentColor"/><circle cx="25" cy="21" r="3" fill="currentColor"/><circle cx="34" cy="29" r="3" fill="currentColor"/><circle cx="42" cy="17" r="3" fill="currentColor"/></svg>';
    div.appendChild(mark);
  }
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  div.appendChild(contentDiv);
  $('messages').appendChild(div);
  $('chatContainer').scrollTop = $('chatContainer').scrollHeight;
}

function appendThinking() {
  const id = `thinking-${Date.now()}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant-message';
  const mark = document.createElement('div'); mark.className = 'assistant-mark'; mark.textContent = '…';
  const content = document.createElement('div'); content.className = 'message-content'; content.textContent = '正在思考…';
  div.append(mark, content); $('messages').appendChild(div);
  return id;
}

async function loadHistory() {
  const res = await fetch(`/express/api/history?participantId=${encodeURIComponent(participantId)}&sessionId=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return;
  const data = await res.json();
  $('messages').innerHTML = '';
  if (!data.messages?.length) {
    appendMessage('assistant', state.research.formal_data
      ? '你已经先完成了自己的判断。现在可以把你最想讨论的问题告诉我；最后怎么改仍由你自己决定。'
      : '你已经先完成了自己的判断。现在可以和我讨论这个失败案例；最后请再用自己的话作决定。');
    return;
  }
  data.messages.forEach(msg => appendMessage(msg.role, msg.content));
}

function openChat() {
  $('preAiForm').hidden = true;
  renderLockedSummary();
  $('lockStatus').textContent = '已锁定';
  $('lockStatus').classList.add('locked');
  $('chatPlaceholder').hidden = true;
  $('chatShell').hidden = false;
  $('finishRow').hidden = false;
  loadHistory();
}

function showCompleted() {
  $('preAiForm').hidden = true;
  $('lockedSummary').hidden = false;
  renderLockedSummary();
  $('chatPlaceholder').hidden = true;
  $('chatShell').hidden = true;
  $('finishRow').hidden = true;
  $('finalForm').hidden = true;
  $('completionCard').hidden = false;
  $('completionTitle').textContent = state.research.formal_data ? '最终修改决定已经保存' : '练习流程已经完成';
  $('completionText').textContent = state.research.formal_data
    ? '接下来请根据你自己的最终决定制作V3，并按老师安排完成复测与反思。'
    : '你已经体验了“先自己判断—和AI讨论—再自己决定”的完整流程。';
}

$('preAiForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('preAiSubmit');
  button.disabled = true;
  try {
    const data = state.research.formal_data
      ? {
          V2_test_data: {
            trial_1: field(form, 'trial_1').value,
            trial_2: field(form, 'trial_2').value,
            trial_3: field(form, 'trial_3').value,
            notes: field(form, 'test_notes').value,
          },
          pre_ai_problem: field(form, 'pre_ai_problem').value,
          pre_ai_evidence: field(form, 'pre_ai_evidence').value,
          pre_ai_revision_options: field(form, 'pre_ai_revision_options').value,
          pre_ai_preferred_revision: field(form, 'pre_ai_preferred_revision').value,
          pre_ai_preference_reason: field(form, 'pre_ai_preference_reason').value,
        }
      : {
          practice_problem: field(form, 'practice_problem').value,
          practice_evidence: field(form, 'practice_evidence').value,
          practice_initial_revision: field(form, 'practice_initial_revision').value,
          practice_initial_reason: field(form, 'practice_initial_reason').value,
        };
    const res = await fetch('/express/api/research/pre-ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, data }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || '提交失败');
    state.record = payload.record;
    openChat();
  } catch (err) {
    showError(err.message);
  } finally {
    button.disabled = false;
  }
});

$('openFinalBtn').addEventListener('click', () => {
  $('chatShell').hidden = true;
  $('finishRow').hidden = true;
  $('finalForm').hidden = false;
});

$('finalForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = state.research.formal_data
    ? {
        post_ai_problem: field(form, 'post_ai_problem').value,
        post_ai_final_revision: field(form, 'post_ai_final_revision').value,
        post_ai_final_reason: field(form, 'post_ai_final_reason').value,
      }
    : {
        practice_post_problem: field(form, 'practice_post_problem').value,
        practice_post_revision: field(form, 'practice_post_revision').value,
        practice_post_reason: field(form, 'practice_post_reason').value,
      };
  try {
    const res = await fetch('/express/api/research/final', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, data }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || '提交失败');
    state.record = payload.record;
    showCompleted();
  } catch (err) {
    showError(err.message);
  }
});

async function sendMessage() {
  if (state.isLoading || state.isImageUploading) return;
  const text = $('messageInput').value.trim();
  if (!text && !state.currentImageId) return;
  appendMessage('user', text || '[图片]');
  $('messageInput').value = '';
  const imageId = state.currentImageId;
  state.currentImageId = null;
  $('imagePreview').hidden = true;
  const thinkingId = appendThinking();
  state.isLoading = true;
  $('sendBtn').disabled = true;
  try {
    const res = await fetch('/express/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, sessionId, message: text || '请结合这张图片和已有记录继续讨论。', imageId }),
    });
    const data = await res.json();
    document.getElementById(thinkingId)?.remove();
    if (!res.ok) throw new Error(data.error || '回复失败');
    appendMessage('assistant', data.message);
  } catch (err) {
    document.getElementById(thinkingId)?.remove();
    appendMessage('system', err.message || '暂时没有收到回复，请重试。');
  } finally {
    state.isLoading = false;
    $('sendBtn').disabled = false;
  }
}

$('sendBtn').addEventListener('click', sendMessage);
$('messageInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
});
$('messageInput').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = `${Math.min(this.scrollHeight, 120)}px`; });
$('imageUploadBtn').addEventListener('click', () => $('imageInput').click());
$('imageInput').addEventListener('change', async function () {
  const file = this.files?.[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { showError('图片大小不能超过4MB。'); return; }
  const formData = new FormData();
  formData.append('image', file); formData.append('participantId', participantId); formData.append('sessionId', sessionId);
  state.isImageUploading = true;
  try {
    const res = await fetch('/express/api/upload-image', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    state.currentImageId = data.imageId;
    $('previewImage').src = URL.createObjectURL(file);
    $('imagePreview').hidden = false;
  } catch (err) { showError(err.message); }
  finally { state.isImageUploading = false; this.value = ''; }
});
$('removeImage').addEventListener('click', () => { state.currentImageId = null; $('imagePreview').hidden = true; });

$('v2PhotoInput').addEventListener('change', async function () {
  const file = this.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file); formData.append('participantId', participantId); formData.append('version', 'V2');
  const labelText = $('v2PhotoUploadLabel').childNodes[0];
  if (labelText) labelText.nodeValue = '上传中…';
  try {
    const res = await fetch('/express/api/research/photo', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    await refreshV2Photo();
  } catch (err) { showError(err.message); }
  finally { if (labelText) labelText.nodeValue = '上传V2照片'; this.value = ''; }
});

async function init() {
  try {
    await loadResearchState();

    // 第1课必须完整体验“独立判断 → 锁定 → 普通AI讨论 → 再判断 → 最终决定”。
    // Practice 不能因为旧状态/缓存中的 ai_enabled 异常而落入非AI占位页。
    const isPracticeAi = state.research.current_stage === 'practice_shopping_bag'
      || (state.research.formal_data === false && state.research.task === 'shopping_bag');

    if (isPracticeAi) {
      state.research.ai_enabled = true;
      renderPractice();
    } else {
      if (!state.research.ai_enabled) return renderNonAiStage();
      renderFormal();
    }

    if (state.record.final_decision_locked) return showCompleted();
    if (state.record.pre_ai_locked) return openChat();
    $('preAiForm').hidden = false;
    $('lockedSummary').hidden = true;
    $('chatPlaceholder').hidden = false;
    $('chatShell').hidden = true;
    $('finishRow').hidden = true;
  } catch (err) {
    $('stageOnly').hidden = false;
    $('researchLayout').hidden = true;
    $('stageOnlyTitle').textContent = '暂时无法进入当前阶段';
    $('stageOnlyText').textContent = err.message;
  }
}

init();
