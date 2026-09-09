import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storageService.js';
import { researchService } from '../services/researchService.js';
import { isAllowedParticipant, normalizeParticipantId } from '../utils/validators.js';
const router=express.Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
const ext=f=>({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[f.mimetype]||'jpg';
router.post('/upload',upload.single('image'),async(req,res)=>{try{
  const id=normalizeParticipantId(req.body?.participantId??req.body?.studentId),version=String(req.body?.version||'').toUpperCase();
  if(!isAllowedParticipant(id))return res.status(403).json({error:'编号无效'});if(!['V1','V2','V3'].includes(version))return res.status(400).json({error:'版本必须是V1、V2或V3'});if(!req.file)return res.status(400).json({error:'请选择JPG、PNG或WEBP图片'});
  const settings=await researchService.getSettings();if(version==='V1'&&!settings.formal_round1_open)return res.status(409).json({error:'第一轮还没有开放，请根据老师安排继续课堂活动。'});if(version==='V2'&&!settings.formal_round1_open)return res.status(409).json({error:'第一轮还没有开放，请根据老师安排继续课堂活动。'});if(version==='V3'&&(settings.formal_round_count!==2||!settings.formal_round2_open))return res.status(409).json({error:'第二轮还没有开放，请根据老师安排继续课堂活动。'});
  if(!(await researchService.canUploadVersion(id,version)))return res.status(409).json({error:'当前阶段不能继续上传这个版本的照片。'});
  const fileName=`${version}_${uuidv4()}.${ext(req.file)}`,filePath=`uploads/${id}/${version}/${fileName}`;await storageService.putObject(filePath,req.file.buffer);
  const meta={file_name:fileName,file_path:filePath,participant_id:id,version,mime:req.file.mimetype,uploaded_at:new Date().toISOString()};const photos=await researchService.addPhoto(id,version,meta);res.json({photo:meta,photos});
}catch(e){console.error(e);if(e.code==='LIMIT_FILE_SIZE')return res.status(400).json({error:'图片不能超过10MB'});res.status(e.status||500).json({error:e.message||'图片上传失败'});}});
router.get('/image/:participantId/:version/:fileName',async(req,res)=>{try{const id=normalizeParticipantId(req.params.participantId),version=String(req.params.version||'').toUpperCase(),fileName=String(req.params.fileName||'');if(!isAllowedParticipant(id))return res.status(403).end();const data=await storageService.getObjectBuffer(`uploads/${id}/${version}/${fileName}`);if(!data)return res.status(404).end();const mime=fileName.endsWith('.png')?'image/png':fileName.endsWith('.webp')?'image/webp':'image/jpeg';res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','private,max-age=60');res.send(data);}catch(e){res.status(500).end();}});
export default router;
