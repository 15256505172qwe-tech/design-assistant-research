import express from 'express';
import { isAllowedParticipant, normalizeParticipantId } from '../utils/validators.js';
import { researchService } from '../services/researchService.js';
const router=express.Router();
router.post('/validate',async(req,res)=>{try{
  const participantId=normalizeParticipantId(req.body?.participantId??req.body?.studentId);
  if(!isAllowedParticipant(participantId))return res.status(400).json({valid:false,message:'编号不正确，请核对老师发给你的参与者编号。'});
  await researchService.touchParticipant(participantId);
  res.json({valid:true,participant_id:participantId,state:await researchService.getStudentState(participantId)});
}catch(e){console.error('validate',e);res.status(500).json({valid:false,message:'暂时无法进入，请稍后重试。'});}});
router.get('/participant/state',async(req,res)=>{try{const id=normalizeParticipantId(req.query.participantId??req.query.studentId);if(!isAllowedParticipant(id))return res.status(403).json({error:'编号无效'});await researchService.touchParticipant(id);res.json({state:await researchService.getStudentState(id),static:researchService.staticContent()});}catch(e){res.status(500).json({error:'读取学习进度失败'});}});
export default router;
