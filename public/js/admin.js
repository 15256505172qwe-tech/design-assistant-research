let selected='';
let studentRows=[];
let currentSort={key:'student_id',dir:1};
const login=document.getElementById('login'),app=document.getElementById('app');
async function api(path,opts={}){return App.api('/admin'+path,opts)}

document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();try{await api('/login',{method:'POST',body:JSON.stringify({password:document.getElementById('password').value})});login.classList.add('hidden');app.classList.remove('hidden');await boot()}catch(x){const d=document.getElementById('loginError');d.textContent=x.message;d.classList.remove('hidden')}};
document.getElementById('logout').onclick=async()=>{await api('/logout',{method:'POST',body:'{}'});location.reload()};

const exportFiles=['students.csv','matching.csv','practice.csv','practice_chat_messages.csv','V2_evidence.csv','judgment_before.csv','chat_messages.csv','chat_sessions.csv','decision_after.csv','V3_results.csv','reflection.csv','scores.csv','all.json'];
document.getElementById('exports').innerHTML=exportFiles.map(x=>`<a class="btn secondary" href="/express/api/admin/export/${x}" target="_blank">${x}</a>`).join('');

async function boot(){await loadSettings();await loadStudents()}
async function loadSettings(){try{const s=await api('/settings');const f=document.getElementById('settingsForm');for(const k of ['practice_open','formal_v2_open','ai_stage_open','v3_submission_open'])f[k].checked=!!s[k];f.number_of_test_trials.value=s.number_of_test_trials;f.max_chat_minutes.value=s.max_chat_minutes;f.shared_rules_of_thumb.value=s.shared_rules_of_thumb||'';}catch(e){}}
document.getElementById('settingsForm').onsubmit=async e=>{e.preventDefault();const f=e.target,b={practice_open:f.practice_open.checked,formal_v2_open:f.formal_v2_open.checked,ai_stage_open:f.ai_stage_open.checked,v3_submission_open:f.v3_submission_open.checked,number_of_test_trials:Number(f.number_of_test_trials.value),max_chat_minutes:Number(f.max_chat_minutes.value),shared_rules_of_thumb:f.shared_rules_of_thumb.value};try{await api('/settings',{method:'POST',body:JSON.stringify(b)});alert('已保存')}catch(x){alert(x.message)}};

function val(v){return v===null||v===undefined||v===''?'—':App.escapeHtml(String(v))}
function numeric(v){const n=Number(v);return Number.isFinite(n)?n:null}
function sortRows(){const {key,dir}=currentSort;studentRows.sort((a,b)=>{if(key==='student_id')return a.student_id.localeCompare(b.student_id)*dir;const av=numeric(a[key]),bv=numeric(b[key]);if(av===null&&bv===null)return a.student_id.localeCompare(b.student_id);if(av===null)return 1;if(bv===null)return -1;return (av-bv)*dir;});}
function renderStudents(){sortRows();document.getElementById('students').innerHTML=`<div class="table-wrap"><table class="admin-table"><thead><tr><th>student_id</th><th>Q2</th><th>P2_mean</th><th>G0</th><th>E0</th><th>H0</th><th>I0</th><th>match_pair_id</th><th>group</th><th>状态</th></tr></thead><tbody>${studentRows.map(s=>`<tr class="student-row" data-id="${App.escapeHtml(s.student_id)}"><td><strong>${App.escapeHtml(s.student_id)}</strong></td><td>${val(s.Q2)}</td><td>${val(s.P2_mean)}</td><td>${val(s.G0)}</td><td>${val(s.E0)}</td><td>${val(s.H0)}</td><td>${val(s.I0)}</td><td>${val(s.match_pair_id)}</td><td><span class="badge">${val(s.group)}</span></td><td class="small">${App.escapeHtml(s.current_stage||'')}</td></tr>`).join('')}</tbody></table></div>`;document.querySelectorAll('.student-row').forEach(x=>x.onclick=()=>loadDetail(x.dataset.id));}
async function loadStudents(){try{studentRows=await api('/students');renderStudents();}catch(e){document.getElementById('students').innerHTML=`<div class="notice warn">${App.escapeHtml(e.message)}</div>`}}
function setSort(key){if(currentSort.key===key)currentSort.dir*=-1;else currentSort={key,dir:key==='student_id'?1:-1};renderStudents()}
document.getElementById('sortQ2').onclick=()=>setSort('Q2');
document.getElementById('sortP2').onclick=()=>setSort('P2_mean');
document.getElementById('sortId').onclick=()=>setSort('student_id');

function q2Options(current){return ['',0,2.5,5,7.5,10].map(v=>`<option value="${v}" ${String(current??'')===String(v)?'selected':''}>${v===''?'未评分':v}</option>`).join('')}
function scoreInput(k,scores){return `<label>${k}<input name="${k}" type="number" min="1" max="5" step="1" value="${scores[k]??''}"></label>`}

async function loadDetail(id){
  selected=id;
  const d=await api(`/student/${id}`),s=d.student,p=d.practice,f=d.formal;
  const scores=f.session?.research_scores||{};
  const p2=f.V2?.P2_mean??f.V2?.mean_descent_time??null;
  const cs=f.chat_session||{};
  const msg=(f.chat||[]).map(m=>`<div class="section"><strong>${m.role==='assistant'?'AI学习助手':'学生'}</strong> · ${m.message_index}<br>${App.escapeHtml(m.content)}</div>`).join('');
  document.getElementById('detail').innerHTML=`
    <h2>${id}</h2>
    <div class="section"><h3>正式匹配与分组</h3>
      <p class="small">首要参考Q2，其次P2_mean；G0/E0/H0/I0仅在Q2、P2接近时辅助平衡。平台不计算任何综合匹配分。</p>
      <div class="grid two"><label>match_pair_id<input id="pairId" value="${App.escapeHtml(s.match_pair_id||'')}" placeholder="例如 pair01"></label><label>group<select id="group"><option value="unassigned">unassigned</option><option value="structured">structured</option><option value="autonomous">autonomous</option></select></label></div>
      <div class="row"><button class="btn secondary" id="saveMatching">保存匹配与组别</button><button class="btn secondary" id="randomizePair">匹配对内随机</button><a class="btn secondary" href="/express/api/admin/export/student/${id}.json" target="_blank">导出该学生JSON</a></div>
      <p class="small">当前：Q2=${val(scores.Q2)}；P2_mean=${val(p2)}；G0/E0/H0/I0=${[scores.G0,scores.E0,scores.H0,scores.I0].map(val).join(' / ')}</p>
    </div>
    <div class="section"><h3>研究者评分（学生不可见）</h3><form id="scoreForm" class="score-grid"><label>Q2（V2产品设计质量）<select name="Q2">${q2Options(scores.Q2)}</select></label>${['G0','E0','H0','I0','G1','E1','H1','I1'].map(k=>scoreInput(k,scores)).join('')}<div class="notice" style="grid-column:1/-1">P2_mean=${val(p2)} 秒，由V2原始测试时间自动计算，不能在这里手工填写。</div><button class="btn" style="grid-column:1/-1">保存评分</button></form></div>
    <div class="section"><h3>干预保真度</h3><p>chat_duration：${val(cs.chat_duration??cs.chat_duration_seconds)} 秒；user_turn_count：${val(cs.user_turn_count??0)}；assistant_turn_count：${val(cs.assistant_turn_count??0)}</p></div>
    <div class="section"><h3>Practice</h3><p><strong>前：</strong>${App.escapeHtml(p.practice_judgment_before||'')}</p><p><strong>后：</strong>${App.escapeHtml(p.practice_judgment_after||'')}</p><p><strong>最终：</strong>${App.escapeHtml(p.practice_final_decision||'')}</p></div>
    <div class="section"><h3>正式V2</h3>${(f.V2?.photos||[]).length?`<div class="photo-grid">${f.V2.photos.map(p=>`<a href="/express/api/image/${id}/V2/${encodeURIComponent(p.file_name)}" target="_blank"><img src="/express/api/image/${id}/V2/${encodeURIComponent(p.file_name)}"></a>`).join('')}</div>`:''}<pre>${App.escapeHtml(JSON.stringify(f.V2,null,2))}</pre></div>
    <div class="section"><h3>AI前</h3><pre>${App.escapeHtml(JSON.stringify(f.judgment_before,null,2))}</pre></div>
    <div class="section"><h3>AI聊天</h3>${msg||'<p class="small">暂无</p>'}</div>
    <div class="section"><h3>AI后</h3><pre>${App.escapeHtml(JSON.stringify(f.decision_after,null,2))}</pre></div>
    <div class="section"><h3>V3与反思</h3>${(f.V3?.photos||[]).length?`<div class="photo-grid">${f.V3.photos.map(p=>`<a href="/express/api/image/${id}/V3/${encodeURIComponent(p.file_name)}" target="_blank"><img src="/express/api/image/${id}/V3/${encodeURIComponent(p.file_name)}"></a>`).join('')}</div>`:''}<pre>${App.escapeHtml(JSON.stringify({V3:f.V3,reflection:f.reflection},null,2))}</pre></div>`;
  document.getElementById('group').value=s.group;
  document.getElementById('saveMatching').onclick=async()=>saveMatching(id,false);
  document.getElementById('randomizePair').onclick=async()=>randomizePair(id);
  document.getElementById('scoreForm').onsubmit=async e=>{e.preventDefault();const b={};new FormData(e.target).forEach((v,k)=>b[k]=v);try{await api(`/student/${id}/scores`,{method:'POST',body:JSON.stringify(b)});alert('评分已保存');await loadStudents();await loadDetail(id)}catch(x){alert(x.message)}};
}

async function saveMatching(id,confirm=false){const match_pair_id=document.getElementById('pairId').value.trim(),group=document.getElementById('group').value;try{await api(`/student/${id}/matching`,{method:'POST',body:JSON.stringify({match_pair_id,group,confirm})});await loadStudents();await loadDetail(id);alert('匹配与组别已保存')}catch(e){if(e.data?.code==='group_confirm_required'&&!confirm&&window.confirm('该学生已经进入正式AI讨论。确定仍要修改匹配或组别吗？'))return saveMatching(id,true);alert(e.message)}}
async function randomizePair(id,confirm=false){const match_pair_id=document.getElementById('pairId').value.trim();if(!match_pair_id)return alert('请先填写并保存match_pair_id');try{const r=await api('/matching/randomize-pair',{method:'POST',body:JSON.stringify({match_pair_id,confirm})});alert(r.assigned.map(x=>`${x.student_id} → ${x.group}`).join('\n'));await loadStudents();await loadDetail(id)}catch(e){if(e.data?.code==='pair_randomize_confirm_required'&&!confirm&&window.confirm('该匹配对已有组别。确定重新随机吗？'))return randomizePair(id,true);alert(e.message)}}

document.getElementById('bulkBtn').onclick=async()=>{try{const r=await api('/matching/bulk',{method:'POST',body:JSON.stringify({text:document.getElementById('bulkText').value})});const bad=r.result.filter(x=>x.status!=='ok');alert(`已处理 ${r.result.length} 行${bad.length?`，其中 ${bad.length} 行未成功`:''}`);await loadStudents()}catch(e){alert(e.message)}};
