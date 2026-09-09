process.env.NODE_ENV='test';
process.env.USE_LOCAL_STORAGE='1';
process.env.LOCAL_STORAGE_DIR='/tmp/design-assistant-smoke';
process.env.EXPERIMENT_RUN_ID=`smoke_${Date.now()}`;
process.env.ALLOWED_PARTICIPANTS='P01,P02';
process.env.COZE_MOCK='1';
process.env.COZE_ACCESS_TOKEN='mock';
process.env.COZE_STRUCTURED_BOT_ID='structured_mock';
process.env.COZE_AUTONOMOUS_BOT_ID='autonomous_mock';

const {researchService}=await import('../src/services/researchService.js');
const {cozeService}=await import('../src/services/cozeService.js');

const id='P01';
await researchService.touchStudent(id);
let student=await researchService.getStudent(id);
if(student.group!=='unassigned')throw new Error('New student must start unassigned');

// Practice：普通GenAI配置，但学生端统一显示“AI学习助手”。
await researchService.lockPracticeBefore(id,'我认为提手连接处可能是薄弱位置');
let ps=await researchService.ensureChatSession(id,'practice','practice');
let r=await cozeService.sendMessage({studentId:id,sessionId:ps.session_id,scope:'practice',mode:'practice',message:'我应该怎么看这个失败？',conversationId:ps.conversation_id});
await researchService.addMessage(id,'practice',{role:'user',content:'我应该怎么看这个失败？'});
await researchService.addMessage(id,'practice',{role:'assistant',content:r.assistant_message,conversation_id:r.conversation_id,bot_id:r.bot_id});
await researchService.updateChatSession(id,'practice',{conversation_id:r.conversation_id,context_sent:true});
await researchService.endChat(id,'practice');
await researchService.completePractice(id,{practice_judgment_after:'我更关注连接处的受力证据',practice_final_decision:'先加强连接处再做相同条件测试'});

// V2：原始时间 + P2_mean 自动保存；Q2由研究者人工录入。
await researchService.saveSettings({practice_open:true,formal_v2_open:true,ai_stage_open:true,v3_submission_open:true,number_of_test_trials:3,max_chat_minutes:25,shared_rules_of_thumb:'一次只改变一个关键变量。'});
await researchService.addPhoto(id,'V2',{file_name:'V2_smoke.jpg',file_path:'uploads/P01/V2/V2_smoke.jpg',student_id:id,version:'V2',mime:'image/jpeg',uploaded_at:new Date().toISOString()});
const v2=await researchService.saveV2Evidence(id,{test_1:2.1,test_2:2.2,test_3:2.3,opened:'yes',sway:'some',rotation:'none',drift:'some',stable_canopy:'partial',other_observation:'有轻微摇摆'});
if(v2.P2_mean!==2.2)throw new Error(`P2_mean incorrect: ${v2.P2_mean}`);
await researchService.patchResearchScores(id,{Q2:7.5,G0:3,E0:3,H0:2,I0:3});
let threw=false;try{await researchService.patchResearchScores(id,{Q2:6});}catch{threw=true}if(!threw)throw new Error('Invalid Q2 value was accepted');

// 匹配完成后才分正式条件。
await researchService.setMatching(id,{match_pair_id:'pair01',group:'structured'},'smoke',true);
student=await researchService.getStudent(id);
if(student.match_pair_id!=='pair01'||student.group!=='structured')throw new Error('Matching assignment failed');

await researchService.lockJudgmentBefore(id,{judgment_before_problem:'摇摆',judgment_before_evidence:'三次测试都出现摇摆',judgment_before_idea:'调整悬线'});
let fs=await researchService.ensureChatSession(id,'formal','structured');
r=await cozeService.sendMessage({studentId:id,sessionId:fs.session_id,scope:'formal',mode:'structured',message:'我该怎样比较方案？',conversationId:fs.conversation_id});
await researchService.addMessage(id,'formal',{role:'user',content:'我该怎样比较方案？'});
await researchService.addMessage(id,'formal',{role:'assistant',content:r.assistant_message,conversation_id:r.conversation_id,bot_id:r.bot_id});
await researchService.updateChatSession(id,'formal',{conversation_id:r.conversation_id,context_sent:true});
const firstConv=r.conversation_id;
r=await cozeService.sendMessage({studentId:id,sessionId:fs.session_id,scope:'formal',mode:'structured',message:'我还想继续比较。',conversationId:firstConv});
if(r.conversation_id!==firstConv)throw new Error('Formal conversation_id changed across turns');
await researchService.addMessage(id,'formal',{role:'user',content:'我还想继续比较。'});
await researchService.addMessage(id,'formal',{role:'assistant',content:r.assistant_message,conversation_id:r.conversation_id,bot_id:r.bot_id});
const ended=await researchService.endChat(id,'formal');
if(ended.user_turn_count!==2||ended.assistant_turn_count!==2)throw new Error('Turn counts incorrect');
if(ended.chat_duration===null||ended.chat_duration_seconds===null)throw new Error('Chat duration not recorded');

await researchService.lockDecision(id,{decision_after_problem:'摇摆',decision_after_change:'调整悬线长度一致性',decision_after_reason:'对应测试观察到的摇摆',decision_after_test:'重点观察摇摆是否减少'});
await researchService.addPhoto(id,'V3',{file_name:'V3_smoke.jpg',file_path:'uploads/P01/V3/V3_smoke.jpg',student_id:id,version:'V3',mime:'image/jpeg',uploaded_at:new Date().toISOString()});
await researchService.saveV3(id,{actual_revision:'统一悬线长度',revision_difference:'',test_1:2.4,test_2:2.5,test_3:2.6,opened:'yes',sway:'none',rotation:'none',drift:'none',stable_canopy:'yes',other_observation:'更稳定'});
await researchService.saveReflection(id,{result_match:'same',strongest_evidence:'摇摆减少且平均时间提高',reconsider_next:'继续比较伞面面积'});
const all=await researchService.getCompleteStudentData(id);
if(!all.practice.completed||!all.formal.reflection?.locked||all.formal.chat.length!==4)throw new Error('Smoke assertions failed');

const id2='P02';
await researchService.touchStudent(id2);
await researchService.setMatching(id2,{match_pair_id:'pair01',group:'autonomous'},'smoke',true);
const auto=await cozeService.sendMessage({studentId:id2,sessionId:'auto_smoke',scope:'formal',mode:'autonomous',message:'测试自主组',conversationId:null});
if(auto.bot_id!=='autonomous_mock')throw new Error('Autonomous bot routing failed');
const practiceBot=await cozeService.sendMessage({studentId:id2,sessionId:'practice_smoke',scope:'practice',mode:'practice',message:'测试练习',conversationId:null});
if(practiceBot.bot_id!=='autonomous_mock')throw new Error('Practice bot routing failed');
console.log('OK: Practice + Q2/P2 matching + Formal V2→AI→Decision→V3 smoke flow passed; chat duration/turn counts and bot routing verified.');
