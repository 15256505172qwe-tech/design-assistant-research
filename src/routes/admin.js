import express from 'express';
import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../middleware/auth.js';
import { storageService } from '../services/storageService.js';
import { researchService } from '../services/researchService.js';
import { allowedStudentIds, normalizeStudentId, validateStudentId } from '../utils/validators.js';
import { SCORE_FIELDS } from '../config/researchConfig.js';

const router=express.Router();
const csv=(v)=>{if(v==null)return '';const s=typeof v==='object'?JSON.stringify(v):String(v);return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
const json=(res,name,data)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename=${name}`);res.send(JSON.stringify(data,null,2));};
const textCsv=(res,name,headers,rows)=>{const lines=[headers.join(','),...rows.map(r=>headers.map(h=>csv(r[h])).join(','))];res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename=${name}`);res.send('\uFEFF'+lines.join('\n'));};
const groupValues=['structured','autonomous','unassigned'];

router.post('/login',async(req,res)=>{try{const password=String(req.body?.password||'');if(!process.env.ADMIN_PASSWORD)return res.status(500).json({error:'服务器未配置ADMIN_PASSWORD'});if(password!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:'密码错误，请重新输入。'});const id=`admin_${uuidv4().replace(/-/g,'')}`;await storageService.putObject(`admin-sessions/${id}.json`,JSON.stringify({created_at:new Date().toISOString(),expires_at:new Date(Date.now()+4*3600000).toISOString()}));res.cookie('admin_session',id,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:4*3600000,path:'/'});res.json({success:true});}catch(e){res.status(500).json({error:'管理员登录服务异常'});}});
router.post('/logout',requireAdmin,async(req,res)=>{if(req.cookies?.admin_session)await storageService.deleteObject(`admin-sessions/${req.cookies.admin_session}.json`);res.clearCookie('admin_session',{path:'/'});res.json({success:true});});

router.get('/settings',requireAdmin,async(req,res)=>res.json(await researchService.getSettings()));
router.post('/settings',requireAdmin,async(req,res)=>{try{res.json(await researchService.saveSettings(req.body||{}));}catch(e){res.status(e.status||500).json({error:e.message});}});

async function ids(){
 const configured=allowedStudentIds();
 const blobs=await storageService.listObjects('students/');
 const fromStore=blobs.map(b=>b.key.split('/').pop()?.replace('.json','')).filter(validateStudentId);
 return [...new Set([...configured,...fromStore])].sort();
}

async function studentSummary(id){
  const [student,state,formal,v2,chat]=await Promise.all([
    researchService.getStudent(id),
    researchService.getStudentState(id),
    researchService.ensureFormalSession(id),
    researchService.getV2Evidence(id),
    researchService.getChatSession(id,'formal'),
  ]);
  const scores=formal.research_scores||{};
  return {
    ...student,
    ...state,
    Q2:scores.Q2??null,
    P2_mean:v2?.P2_mean??v2?.mean_descent_time??null,
    G0:scores.G0??null,E0:scores.E0??null,H0:scores.H0??null,I0:scores.I0??null,
    chat_duration:chat?.chat_duration??chat?.chat_duration_seconds??null,
    chat_duration_seconds:chat?.chat_duration_seconds??null,
    user_turn_count:chat?.user_turn_count??0,
    assistant_turn_count:chat?.assistant_turn_count??0,
  };
}

router.get('/students',requireAdmin,async(req,res)=>{try{const out=[];for(const id of await ids())out.push(await studentSummary(id));res.json(out);}catch(e){console.error(e);res.status(500).json({error:'读取学生列表失败'});}});
router.get('/student/:studentId',requireAdmin,async(req,res)=>{try{const id=normalizeStudentId(req.params.studentId);res.json(await researchService.getCompleteStudentData(id));}catch(e){res.status(500).json({error:'读取学生资料失败'});}});

// 兼容单独修改组别；正式匹配优先使用 /matching。
router.post('/student/:studentId/group',requireAdmin,async(req,res)=>{try{const id=normalizeStudentId(req.params.studentId);res.json(await researchService.setGroup(id,req.body?.group,'admin',Boolean(req.body?.confirm)));}catch(e){res.status(e.status||500).json({error:e.message,code:e.code});}});

router.post('/student/:studentId/matching',requireAdmin,async(req,res)=>{try{
  const id=normalizeStudentId(req.params.studentId);
  if(!validateStudentId(id))return res.status(400).json({error:'学生编号无效'});
  res.json(await researchService.setMatching(id,{match_pair_id:req.body?.match_pair_id,group:req.body?.group||'unassigned'},'admin',Boolean(req.body?.confirm)));
}catch(e){res.status(e.status||500).json({error:e.message,code:e.code});}});

// 批量导入格式：student_id / match_pair_id / group。支持空格、Tab或英文逗号分隔。
router.post('/matching/bulk',requireAdmin,async(req,res)=>{try{
  const lines=String(req.body?.text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const result=[];
  for(const line of lines){
    const parts=line.split(/[\t, ]+/).map(x=>x.trim()).filter(Boolean);
    const [rawId,matchPairId,rawGroup]=parts;
    const id=normalizeStudentId(rawId),group=String(rawGroup||'').toLowerCase();
    if(parts.length<3||!validateStudentId(id)||!matchPairId||!groupValues.includes(group)){result.push({line,status:'invalid'});continue;}
    try{await researchService.setMatching(id,{match_pair_id:matchPairId,group},'bulk',Boolean(req.body?.confirm));result.push({student_id:id,match_pair_id:matchPairId,group,status:'ok'});}catch(e){result.push({student_id:id,match_pair_id:matchPairId,group,status:'error',error:e.message});}
  }
  res.json({result});
}catch(e){res.status(500).json({error:'批量匹配分组失败'});}});

// 可选辅助：研究者先手工指定match_pair_id，再在匹配对内随机分配两种正式条件。
router.post('/matching/randomize-pair',requireAdmin,async(req,res)=>{try{
  const pairId=String(req.body?.match_pair_id||'').trim();
  if(!pairId)return res.status(400).json({error:'请先填写match_pair_id'});
  const matched=[];
  for(const id of await ids()){const s=await researchService.getStudent(id);if(s.match_pair_id===pairId)matched.push(s);}
  if(matched.length!==2)return res.status(409).json({error:`匹配对 ${pairId} 当前有 ${matched.length} 人，必须正好2人才能随机。`,code:'pair_size_invalid'});
  if(matched.some(s=>s.group!=='unassigned')&&!req.body?.confirm)return res.status(409).json({error:'该匹配对已有正式组别。确定重新随机吗？',code:'pair_randomize_confirm_required'});
  const flip=randomInt(2);
  const groups=flip===0?['structured','autonomous']:['autonomous','structured'];
  const assigned=[];
  for(let i=0;i<2;i++)assigned.push(await researchService.setMatching(matched[i].student_id,{match_pair_id:pairId,group:groups[i]},'pair-random',Boolean(req.body?.confirm)));
  res.json({match_pair_id:pairId,assigned:assigned.map(s=>({student_id:s.student_id,group:s.group}))});
}catch(e){res.status(e.status||500).json({error:e.message,code:e.code});}});

router.post('/student/:studentId/scores',requireAdmin,async(req,res)=>{try{res.json(await researchService.patchResearchScores(normalizeStudentId(req.params.studentId),req.body||{}));}catch(e){res.status(e.status||500).json({error:e.message});}});

async function allData(){const out=[];for(const id of await ids())out.push(await researchService.getCompleteStudentData(id));return out;}
router.get('/export/all.json',requireAdmin,async(req,res)=>json(res,'research_all.json',await allData()));
router.get('/export/student/:studentId.json',requireAdmin,async(req,res)=>json(res,`${normalizeStudentId(req.params.studentId)}.json`,await researchService.getCompleteStudentData(normalizeStudentId(req.params.studentId))));

router.get('/export/students.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push(await studentSummary(id));textCsv(res,'students.csv',['student_id','Q2','P2_mean','G0','E0','H0','I0','match_pair_id','group','current_stage','practice_completed','formal_started','chat_completed','v3_completed','chat_duration','user_turn_count','assistant_turn_count','group_assigned_at','last_active_at'],rows);});
router.get('/export/matching.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push(await studentSummary(id));textCsv(res,'matching.csv',['student_id','Q2','P2_mean','G0','E0','H0','I0','match_pair_id','group'],rows);});
router.get('/export/practice.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push(await researchService.getPractice(id));textCsv(res,'practice.csv',['student_id','practice_judgment_before','before_submitted_at','chat_completed','practice_judgment_after','practice_final_decision','completed','completed_at'],rows);});
router.get('/export/V2_evidence.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push({student_id:id,...(await researchService.getV2Evidence(id)||{})});textCsv(res,'V2_evidence.csv',['student_id','test_1','test_2','test_3','P2_mean','mean_descent_time','opened','sway','rotation','drift','stable_canopy','other_observation','photos','updated_at'],rows);});
router.get('/export/judgment_before.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push({student_id:id,...(await researchService.getJudgmentBefore(id)||{})});textCsv(res,'judgment_before.csv',['student_id','judgment_before_problem','judgment_before_evidence','judgment_before_idea','submitted_at'],rows);});
router.get('/export/practice_chat_messages.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push(...await researchService.getMessages(id,'practice'));textCsv(res,'practice_chat_messages.csv',['student_id','task_type','session_id','message_index','message_id','role','content','conversation_id','chat_id','bot_id','created_at'],rows);});
router.get('/export/chat_messages.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push(...await researchService.getMessages(id,'formal'));textCsv(res,'chat_messages.csv',['student_id','group','task_type','session_id','message_index','message_id','role','content','conversation_id','chat_id','bot_id','created_at'],rows);});
router.get('/export/chat_sessions.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids()){const s=await researchService.getStudent(id),c=await researchService.getChatSession(id,'formal');rows.push({student_id:id,match_pair_id:s.match_pair_id,group:s.group,...(c||{})});}textCsv(res,'chat_sessions.csv',['student_id','match_pair_id','group','session_id','conversation_id','started_at','ended_at','chat_duration','chat_duration_seconds','user_turn_count','assistant_turn_count','mode'],rows);});
router.get('/export/decision_after.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push({student_id:id,...(await researchService.getDecision(id)||{})});textCsv(res,'decision_after.csv',['student_id','decision_after_problem','decision_after_change','decision_after_reason','decision_after_test','submitted_at'],rows);});
router.get('/export/V3_results.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push({student_id:id,...(await researchService.getV3(id)||{})});textCsv(res,'V3_results.csv',['student_id','actual_revision','revision_difference','test_1','test_2','test_3','mean_descent_time','opened','sway','rotation','drift','stable_canopy','other_observation','photos','submitted_at'],rows);});
router.get('/export/reflection.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids())rows.push({student_id:id,...(await researchService.getReflection(id)||{})});textCsv(res,'reflection.csv',['student_id','result_match','strongest_evidence','reconsider_next','submitted_at'],rows);});
router.get('/export/scores.csv',requireAdmin,async(req,res)=>{const rows=[];for(const id of await ids()){const d=await researchService.getCompleteStudentData(id);rows.push({student_id:id,match_pair_id:d.student.match_pair_id,group:d.student.group,P2_mean:d.formal.V2?.P2_mean??d.formal.V2?.mean_descent_time??null,...(d.formal.session.research_scores||{})});}textCsv(res,'research_scores.csv',['student_id','Q2','P2_mean','G0','E0','H0','I0','G1','E1','H1','I1','match_pair_id','group'],rows);});
export default router;
