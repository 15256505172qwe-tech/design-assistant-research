import express from 'express';
import multer from 'multer';
import { storageService } from '../services/storageService.js';
import { sessionService } from '../services/sessionService.js';
import { researchService } from '../services/researchService.js';
import { v4 as uuidv4 } from 'uuid';
import { validateParticipantId } from '../utils/validators.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持 JPG、PNG、WEBP 格式'));
  },
});

function normalizeId(value) {
  return String(value || '').toUpperCase().trim();
}

function isAllowed(id) {
  if (!validateParticipantId(id)) return false;
  return (process.env.ALLOWED_PARTICIPANTS || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .includes(id);
}

function extensionFor(file) {
  const nameExt = file.originalname?.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp'].includes(nameExt)) return nameExt;
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.mimetype] || 'jpg';
}

router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const participantId = normalizeId(req.body?.participantId);
    const sessionId = String(req.body?.sessionId || '');
    if (!participantId || !sessionId) return res.status(400).json({ error: '缺少参与者或会话信息' });
    if (!isAllowed(participantId)) return res.status(403).json({ error: '未授权' });
    const session = await sessionService.getSession(sessionId);
    if (!session || session.active === false || session.participant_id !== participantId) return res.status(404).json({ error: '会话不存在或已过期' });
    if (!req.file) return res.status(400).json({ error: '请选择图片' });

    const ext = extensionFor(req.file);
    const imageId = `${uuidv4()}.${ext}`;
    const path = `images/${participantId}/${sessionId}/${imageId}`;
    await storageService.putObject(path, req.file.buffer);
    res.json({ success: true, imageId, message: '图片上传成功' });
  } catch (err) {
    console.error('Chat image upload error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '图片大小超过4MB限制' });
    res.status(500).json({ error: err.message || '图片上传失败，请重试' });
  }
});

router.post('/research/photo', upload.single('image'), async (req, res) => {
  try {
    const participantId = normalizeId(req.body?.participantId);
    const version = String(req.body?.version || '').toUpperCase();
    if (!isAllowed(participantId)) return res.status(403).json({ error: '未授权' });
    if (!['V1', 'V2', 'V3'].includes(version)) return res.status(400).json({ error: '版本必须是 V1、V2 或 V3' });
    if (!req.file) return res.status(400).json({ error: '请选择图片' });

    const ext = extensionFor(req.file);
    const filename = `${version}_${uuidv4()}.${ext}`;
    const path = `research-images/${participantId}/${filename}`;
    await storageService.putObject(path, req.file.buffer);
    const meta = {
      path,
      filename,
      mime: req.file.mimetype,
      uploaded_at: new Date().toISOString(),
    };
    await researchService.setPhoto(participantId, version, meta);
    res.json({ success: true, photo: meta });
  } catch (err) {
    console.error('Research photo upload error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '图片大小超过4MB限制' });
    res.status(err.status || 500).json({ error: err.message || '研究照片上传失败' });
  }
});

router.get('/research/photo/:participantId/:version', async (req, res) => {
  try {
    const participantId = normalizeId(req.params.participantId);
    const version = String(req.params.version || '').toUpperCase();
    if (!isAllowed(participantId)) return res.status(403).json({ error: '未授权' });
    const photo = await researchService.getPhoto(participantId, version);
    if (!photo?.path) return res.status(404).json({ error: '暂无照片' });
    const buffer = await storageService.getObjectBuffer(photo.path);
    if (!buffer) return res.status(404).json({ error: '照片不存在' });
    res.setHeader('Content-Type', photo.mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buffer);
  } catch (err) {
    console.error('Research photo get error:', err);
    res.status(500).json({ error: '读取照片失败' });
  }
});

export default router;
