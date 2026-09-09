import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storageService.js';
import { researchService } from '../services/researchService.js';
import { isAllowedStudent, normalizeStudentId } from '../utils/validators.js';

const router=express.Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
function ext(file){return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.mimetype]||'jpg';}
router.post('/upload',upload.single('image'),async(req,res)=>{try{
 const id=normalizeStudentId(req.body?.studentId),version=String(req.body?.version||'').toUpperCase();
 if(!isAllowedStudent(id))return res.status(403).json({error:'编号无效'}); if(!['V2','V3'].includes(version))return res.status(400).json({error:'版本必须是V2或V3'}); if(!req.file)return res.status(400).json({error:'请选择JPG、PNG或WEBP图片'});
 const settings=await researchService.getSettings();
 if(version==='V2'){const before=await researchService.getJudgmentBefore(id);if(!settings.formal_v2_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});if(before?.locked)return res.status(409).json({error:'AI前判断已锁定，V2照片不能再由学生覆盖。'});}
 if(version==='V3'){const decision=await researchService.getDecision(id),v3=await researchService.getV3(id);if(!settings.v3_submission_open)return res.status(409).json({error:'这一部分还没有开放，请根据老师安排继续课堂活动。'});if(!decision?.locked)return res.status(409).json({error:'请先完成最终修改决定。'});if(v3?.locked)return res.status(409).json({error:'V3已最终提交，不能继续上传。'});}
 const fileName=`${version}_${uuidv4()}.${ext(req.file)}`; const filePath=`uploads/${id}/${version}/${fileName}`; await storageService.putObject(filePath,req.file.buffer);
 const meta={file_name:fileName,file_path:filePath,student_id:id,version,mime:req.file.mimetype,uploaded_at:new Date().toISOString()};
 const photos=await researchService.addPhoto(id,version,meta); res.json({photo:meta,photos});
}catch(e){console.error(e);if(e.code==='LIMIT_FILE_SIZE')return res.status(400).json({error:'图片不能超过10MB'});res.status(e.status||500).json({error:e.message||'图片上传失败'});}});
router.get('/image/:studentId/:version/:fileName',async(req,res)=>{try{
 const id=normalizeStudentId(req.params.studentId),version=String(req.params.version||'').toUpperCase(),fileName=String(req.params.fileName||'');
 if(!isAllowedStudent(id))return res.status(403).end(); const key=`uploads/${id}/${version}/${fileName}`;const data=await storageService.getObjectBuffer(key);if(!data)return res.status(404).end();
 const mime=fileName.endsWith('.png')?'image/png':fileName.endsWith('.webp')?'image/webp':'image/jpeg';res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','private,max-age=60');res.send(data);
}catch(e){res.status(500).end();}});
export default router;
