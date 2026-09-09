import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const root=process.cwd(),files=[];
function walk(d){for(const n of readdirSync(d)){if(['node_modules','.git','data'].includes(n))continue;const p=join(d,n),s=statSync(p);if(s.isDirectory())walk(p);else if(/\.(js|mjs)$/.test(n))files.push(p)}}
walk(root);let bad=false;
for(const f of files){try{execFileSync(process.execPath,['--check',f],{stdio:'pipe'})}catch(e){bad=true;console.error('Syntax:',relative(root,f),e.stderr?.toString()||e.message)}}
const must=['public/index.html','public/home.html','public/practice.html','public/formal.html','public/chat.html','public/decision.html','public/v3.html','public/complete.html','public/admin.html','cloud-functions/express/[[default]].js','.env.example','README.md','public/assets/shopping-bag-failure.svg'];
for(const f of must){try{readFileSync(join(root,f))}catch{bad=true;console.error('Missing',f)}}
const studentFiles=['public/index.html','public/home.html','public/practice.html','public/formal.html','public/chat.html','public/decision.html','public/v3.html','public/complete.html','public/js/index.js','public/js/home.js','public/js/practice.js','public/js/formal.js','public/js/chat.js','public/js/decision.js','public/js/v3.js'];
const studentPublic=studentFiles.map(f=>readFileSync(join(root,f),'utf8')).join('\n');
for(const token of ['IDTLM','Troubleshoot','Weigh Options','Revise/Iterate','Reflect on Process','实验组','对照组','Structured','Autonomous','Base AI'])if(studentPublic.includes(token)){bad=true;console.error('Student UI exposes research term:',token)}
for(const token of ['COZE_ACCESS_TOKEN','COZE_STRUCTURED_BOT_ID','COZE_AUTONOMOUS_BOT_ID'])if(studentPublic.includes(token)){bad=true;console.error('Frontend exposes secret env name:',token)}
const config=readFileSync(join(root,'src/config/researchConfig.js'),'utf8');
if(!config.includes("practice_open: true")){bad=true;console.error('Practice not open by default')}
for(const x of ["'Q2'","'G0'","'E0'","'H0'","'I0'"])if(!config.includes(x)){bad=true;console.error('Matching/score field missing',x)}
const research=readFileSync(join(root,'src/services/researchService.js'),'utf8');
for(const x of ['practice_sessions/','prototype_tests/','judgments/','chat_sessions/','chat_messages/','final_decisions/','reflections/','settings/system.json'])if(!research.includes(x)){bad=true;console.error('Missing normalized storage path',x)}
for(const x of ['P2_mean','match_pair_id','user_turn_count','assistant_turn_count','chat_duration'])if(!research.includes(x)){bad=true;console.error('Required matching/fidelity field missing',x)}
for(const forbidden of ['baseline_total','matching_score','GEHI_total','weighted_score'])if(research.includes(forbidden)||studentPublic.includes(forbidden)){bad=true;console.error('Forbidden composite score exists:',forbidden)}
if(!studentPublic.includes('Shopping Bag')||!readFileSync(join(root,'public/practice.html'),'utf8').includes('shopping-bag-failure.svg')){bad=true;console.error('Practice fixed evidence image missing')}
const coze=readFileSync(join(root,'src/services/cozeService.js'),'utf8');if(!coze.includes('auto_save_history: true')||!coze.includes('conversationId')||!coze.includes('required_action')){bad=true;console.error('Continuous Coze conversation contract missing')}
const entry=readFileSync(join(root,'cloud-functions/express/[[default]].js'),'utf8');for(const x of ["app.use('/api',authRoutes)","app.use('/api',researchRoutes)","app.use('/api',chatRoutes)","app.use('/api/admin',adminRoutes)",'export default app'])if(!entry.includes(x)){bad=true;console.error('EdgeOne route missing',x)}
if(!research.includes('请先上传至少1张V2照片')||!research.includes('请先上传至少1张V3照片')){bad=true;console.error('Photo completeness guards missing')}
const chatPublic=readFileSync(join(root,'public/js/chat.js'),'utf8');if(!chatPublic.includes('input.value=value')){bad=true;console.error('Failed-send input restore missing')}
const formalPublic=readFileSync(join(root,'public/js/formal.js'),'utf8');if(!formalPublic.includes('formal_ai_eligible')){bad=true;console.error('Unassigned-group AI gate missing in formal UI')}
const admin=readFileSync(join(root,'public/js/admin.js'),'utf8');for(const x of ['Q2','P2_mean','match_pair_id','sortQ2','sortP2','匹配对内随机'])if(!admin.includes(x)){bad=true;console.error('Admin matching feature missing',x)}
if(bad)process.exit(1);console.log(`OK: ${files.length} JS files parsed; matching logic, fidelity fields, research separation, EdgeOne routes, continuous chat and privacy checks passed.`);
