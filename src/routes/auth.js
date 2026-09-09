import express from 'express';
import { isAllowedStudent, normalizeStudentId } from '../utils/validators.js';
import { researchService } from '../services/researchService.js';
const router = express.Router();

router.post('/validate', async (req,res)=>{
  try {
    const studentId = normalizeStudentId(req.body?.studentId ?? req.body?.participantId);
    if (!isAllowedStudent(studentId)) return res.status(400).json({ valid:false, message:'编号不正确，请核对老师发给你的学生编号。' });
    await researchService.touchStudent(studentId);
    const state = await researchService.getStudentState(studentId);
    res.json({ valid:true, student_id:studentId, state });
  } catch (e) {
    console.error('validate',e); res.status(500).json({ valid:false, message:'暂时无法进入，请稍后重试。' });
  }
});

router.get('/student/state', async (req,res)=>{
  try {
    const id = normalizeStudentId(req.query.studentId);
    if (!isAllowedStudent(id)) return res.status(403).json({error:'编号无效'});
    await researchService.touchStudent(id);
    res.json({ state: await researchService.getStudentState(id), static: researchService.staticContent() });
  } catch(e){ console.error(e); res.status(500).json({error:'读取学习进度失败'}); }
});
export default router;
