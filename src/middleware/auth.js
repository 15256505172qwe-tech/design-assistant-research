import { storageService } from '../services/storageService.js';

export async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.admin_session;
    if (!token) return res.status(401).json({ error: '请先登录管理员后台' });
    const raw = await storageService.getObject(`admin-sessions/${token}.json`);
    if (!raw) return res.status(401).json({ error: '管理员登录已过期' });
    const session = JSON.parse(raw);
    if (!session.expires_at || Date.parse(session.expires_at) < Date.now()) {
      await storageService.deleteObject(`admin-sessions/${token}.json`);
      return res.status(401).json({ error: '管理员登录已过期' });
    }
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(500).json({ error: '管理员认证失败' });
  }
}
