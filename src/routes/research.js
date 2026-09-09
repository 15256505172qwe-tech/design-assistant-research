import express from 'express';
import { researchService } from '../services/researchService.js';
import { isAllowedParticipant, normalizeParticipantId } from '../utils/validators.js';
const router=express.Router();
const pid=req=>normalizeParticipantId(req.body?.participantId??req.body?.studentId??req.query?.participantId??req.query?.studentId??req.params?.participantId);
const guard=(id,res)=>{if(!isAllowedParticipant(id)){res.status(403).json({error:'编号无效'});return false;}return true;};
const send=(res,e)=>res.status(e.status||500).json({error:e.message||'操作失败',code:e.code});

router.get('/practice',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;const settings=await researchService.getSettings();if(!settings.practice_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({case:researchService.staticContent().practice,record:await researchService.getPractice(id)});}catch(e){send(res,e);}});
router.post('/practice/before',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;const settings=await researchService.getSettings();if(!settings.practice_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({record:await researchService.lockPracticeBefore(id,req.body||{})});}catch(e){send(res,e);}});

router.get('/formal',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;const settings=await researchService.getSettings(),state=await researchService.getFormalStage(id);res.json({settings,state,round1:await researchService.getRoundData(id,1),round2:await researchService.getRoundData(id,2),static:researchService.staticContent().parachute});}catch(e){send(res,e);}});
router.post('/formal/evidence/:round',async(req,res)=>{try{const id=pid(req),round=Number(req.params.round);if(!guard(id,res))return;const settings=await researchService.getSettings();if(round!==1||!settings.formal_round1_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({record:await researchService.saveEvidence(id,round,req.body||{})});}catch(e){send(res,e);}});
router.post('/formal/initial/:round',async(req,res)=>{try{const id=pid(req),round=Number(req.params.round),settings=await researchService.getSettings();if(!guard(id,res))return;if(round===1&&!settings.formal_round1_open)return res.status(409).json({error:'第一轮还没有开放，请根据老师安排继续课堂活动。'});if(round===2&&(settings.formal_round_count!==2||!settings.formal_round2_open))return res.status(409).json({error:'第二轮还没有开放，请根据老师安排继续课堂活动。'});res.json({record:await researchService.lockInitial(id,round,req.body||{})});}catch(e){send(res,e);}});
router.post('/formal/final/:round',async(req,res)=>{try{const id=pid(req),round=Number(req.params.round);if(!guard(id,res))return;const chat=await researchService.getChatSession(id,round===2?'round2':'round1');if(!chat?.locked)return res.status(409).json({error:'请先结束本轮AI讨论。'});res.json({record:await researchService.lockFinal(id,round,req.body||{})});}catch(e){send(res,e);}});
router.post('/formal/alternative/:round',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;res.json({record:await researchService.saveAlternative(id,Number(req.params.round),req.body||{})});}catch(e){send(res,e);}});
router.post('/formal/revision/:round',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;res.json({record:await researchService.saveRevision(id,Number(req.params.round),req.body||{})});}catch(e){send(res,e);}});
router.post('/formal/self-verification/:round',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;res.json({record:await researchService.saveSelfVerification(id,Number(req.params.round),req.body||{})});}catch(e){send(res,e);}});
router.post('/formal/retest/:round',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;res.json({record:await researchService.saveRetest(id,Number(req.params.round),req.body||{})});}catch(e){send(res,e);}});
router.post('/formal/reflection/:round',async(req,res)=>{try{const id=pid(req);if(!guard(id,res))return;res.json({record:await researchService.saveReflection(id,Number(req.params.round),req.body||{})});}catch(e){send(res,e);}});
export default router;
