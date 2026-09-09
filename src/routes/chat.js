import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { cozeService } from '../services/cozeService.js';
import { researchService } from '../services/researchService.js';
import { isAllowedStudent, normalizeStudentId, validateMessage } from '../utils/validators.js';
const router=express.Router();
const iso=()=>new Date().toISOString();
function sendErr(res,e){res.status(e.status||500).json({error:e.message||'聊天服务暂时不可用'});}

async function modeFor(id,scope){ if(scope==='practice') return 'practice'; const s=await researchService.getStudent(id); if(!['structured','autonomous'].includes(s.group)) throw Object.assign(new Error('AI讨论尚未为你的编号开放，请联系老师。'),{status:409}); return s.group; }
async function requireReady(id,scope){
 const settings=await researchService.getSettings();
 if(scope==='practice') { if(!settings.practice_open) throw Object.assign(new Error('这一部分还没有开放，请根据老师安排继续课堂活动。'),{status:409}); const p=await researchService.getPractice(id); if(!p.before_locked) throw Object.assign(new Error('请先提交并锁定你自己的判断。'),{status:409}); if(p.completed) throw Object.assign(new Error('练习已经完成。'),{status:409}); return settings; }
 if(!settings.ai_stage_open) throw Object.assign(new Error('这一部分还没有开放，请根据老师安排继续课堂活动。'),{status:409});
 const before=await researchService.getJudgmentBefore(id); if(!before?.locked) throw Object.assign(new Error('请先记录并锁定AI讨论前的判断。'),{status:409});
 const decision=await researchService.getDecision(id); if(decision?.locked) throw Object.assign(new Error('最终决定已经提交，本次AI讨论已结束。'),{status:409}); return settings;
}

router.get('/chat/state', async(req,res)=>{try{const id=normalizeStudentId(req.query.studentId),scope=req.query.scope==='practice'?'practice':'formal'; if(!isAllowedStudent(id))return res.status(403).json({error:'编号无效'}); const settings=await requireReady(id,scope); const mode=await modeFor(id,scope); let session=await researchService.getChatSession(id,scope); const messages=await researchService.getMessages(id,scope); res.json({scope,session,messages,max_chat_minutes:settings.max_chat_minutes,can_start:!session,ended:Boolean(session?.ended_at)});}catch(e){sendErr(res,e)}});

router.post('/chat/start', async(req,res)=>{try{const id=normalizeStudentId(req.body?.studentId),scope=req.body?.scope==='practice'?'practice':'formal';if(!isAllowedStudent(id))return res.status(403).json({error:'编号无效'});const settings=await requireReady(id,scope);const mode=await modeFor(id,scope);const session=await researchService.ensureChatSession(id,scope,mode);res.json({session,max_chat_minutes:settings.max_chat_minutes});}catch(e){sendErr(res,e)}});

router.post('/chat', async(req,res)=>{try{
 const id=normalizeStudentId(req.body?.studentId),scope=req.body?.scope==='practice'?'practice':'formal',message=String(req.body?.message||''),clientMessageId=String(req.body?.clientMessageId||'');
 if(!isAllowedStudent(id))return res.status(403).json({error:'编号无效'}); if(!validateMessage(message))return res.status(400).json({error:'消息为空或过长'});
 const settings=await requireReady(id,scope); const mode=await modeFor(id,scope); let session=await researchService.ensureChatSession(id,scope,mode);
 if(session.ended_at)return res.status(409).json({error:'本次AI讨论已经结束。'});
 const elapsed=Math.floor((Date.now()-Date.parse(session.started_at))/1000); if(elapsed>=settings.max_chat_minutes*60){ await researchService.endChat(id,scope); return res.status(409).json({error:'本次讨论时间已结束，请进入下一步记录你的最终决定。',time_up:true}); }
 const existingMessages=await researchService.getMessages(id,scope);if(!existingMessages.some(m=>m.role==='user'&&m.client_message_id&&m.client_message_id===clientMessageId)){await researchService.addMessage(id,scope,{message_id:`local_${uuidv4()}`,client_message_id:clientMessageId||`generated_${uuidv4()}`,role:'user',content:message,created_at:iso(),group:mode==='practice'?'':mode});}
 let prompt=message; if(!session.context_sent){ prompt=`${scope==='practice'?await researchService.buildPracticeAiContext(id):await researchService.buildFormalAiContext(id)}\n\n【学生当前消息】\n${message}`; }
 const ai=await cozeService.sendMessage({studentId:id,sessionId:session.session_id,scope,mode,conversationId:session.conversation_id,message:prompt});
 await researchService.addMessage(id,scope,{message_id:ai.message_id||`assistant_${uuidv4()}`,role:'assistant',content:ai.assistant_message,created_at:iso(),conversation_id:ai.conversation_id,chat_id:ai.chat_id,bot_id:ai.bot_id,group:mode==='practice'?'':mode});
 session=await researchService.updateChatSession(id,scope,{conversation_id:ai.conversation_id,context_sent:true});
 const elapsedAfter=Math.floor((Date.now()-Date.parse(session.started_at))/1000); const timeUp=elapsedAfter>=settings.max_chat_minutes*60;
 if(timeUp) session=await researchService.endChat(id,scope);
 res.json({message:ai.assistant_message,conversation_id:ai.conversation_id,time_up:timeUp,elapsed_seconds:elapsedAfter});
 }catch(e){console.error('chat',e);sendErr(res,e)}});

router.post('/chat/end', async(req,res)=>{try{const id=normalizeStudentId(req.body?.studentId),scope=req.body?.scope==='practice'?'practice':'formal';if(!isAllowedStudent(id))return res.status(403).json({error:'编号无效'});await requireReady(id,scope);res.json({session:await researchService.endChat(id,scope)});}catch(e){sendErr(res,e)}});
export default router;
