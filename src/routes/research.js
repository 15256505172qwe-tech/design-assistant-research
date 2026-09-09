import express from 'express';
import { researchService } from '../services/researchService.js';
import { isAllowedStudent, normalizeStudentId } from '../utils/validators.js';
const router=express.Router();
function sid(req){ return normalizeStudentId(req.body?.studentId ?? req.query?.studentId ?? req.params?.studentId); }
function guard(id,res){ if(!isAllowedStudent(id)){res.status(403).json({error:'编号无效'}); return false;} return true; }
function sendErr(res,e){ res.status(e.status||500).json({error:e.message||'操作失败', code:e.code}); }

router.get('/practice', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return; const settings=await researchService.getSettings(); if(!settings.practice_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'}); res.json({case:researchService.staticContent().practice,record:await researchService.getPractice(id)});}catch(e){sendErr(res,e)}});
router.post('/practice/before', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return; const settings=await researchService.getSettings();if(!settings.practice_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({record:await researchService.lockPracticeBefore(id,req.body?.practice_judgment_before)});}catch(e){sendErr(res,e)}});
router.post('/practice/complete', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return;res.json({record:await researchService.completePractice(id,req.body)});}catch(e){sendErr(res,e)}});

router.get('/formal', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return;const settings=await researchService.getSettings();const [v2,before,decision,v3,reflection,state]=await Promise.all([researchService.getV2Evidence(id),researchService.getJudgmentBefore(id),researchService.getDecision(id),researchService.getV3(id),researchService.getReflection(id),researchService.getStudentState(id)]);res.json({settings,state,v2,before,decision,v3,reflection,static:researchService.staticContent().parachute});}catch(e){sendErr(res,e)}});
router.post('/formal/v2', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return;const settings=await researchService.getSettings();if(!settings.formal_v2_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({v2:await researchService.saveV2Evidence(id,req.body)});}catch(e){sendErr(res,e)}});
router.post('/formal/judgment-before', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return;const settings=await researchService.getSettings();if(!settings.formal_v2_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({judgment:await researchService.lockJudgmentBefore(id,req.body)});}catch(e){sendErr(res,e)}});
router.post('/formal/decision', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return;res.json({decision:await researchService.lockDecision(id,req.body)});}catch(e){sendErr(res,e)}});
router.post('/formal/v3', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return;const settings=await researchService.getSettings();if(!settings.v3_submission_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({v3:await researchService.saveV3(id,req.body)});}catch(e){sendErr(res,e)}});
router.post('/formal/reflection', async(req,res)=>{try{const id=sid(req);if(!guard(id,res))return;const settings=await researchService.getSettings();if(!settings.v3_submission_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});res.json({reflection:await researchService.saveReflection(id,req.body)});}catch(e){sendErr(res,e)}});
export default router;
