const API='/express/api';
function sid(){return sessionStorage.getItem('student_id')||''}
function requireStudent(){const id=sid();if(!id){location.href='/';throw new Error('no student');}return id}
async function api(path,opts={}){const r=await fetch(API+path,{credentials:'same-origin',headers:{...(opts.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(opts.headers||{})},...opts});let data={};try{data=await r.json()}catch{}if(!r.ok)throw Object.assign(new Error(data.error||data.message||'请求失败'),{status:r.status,data});return data}
function escapeHtml(v=''){return String(v).replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}
function setStudentTag(){const e=document.querySelector('[data-student-tag]');if(e)e.textContent=sid()}
function confirmLock(text){return confirm(text)}
function trialInputs(prefix,count=3,values={}){return Array.from({length:count},(_,i)=>`<label>第${i+1}次（秒）<input type="number" step="0.01" min="0" name="${prefix}_${i+1}" value="${values[`${prefix}_${i+1}`]??''}" required></label>`).join('')}
window.App={API,sid,requireStudent,api,escapeHtml,setStudentTag,confirmLock,trialInputs};
