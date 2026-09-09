import { storageService } from '../services/storageService.js';

// 管理员鉴权中间件
export async function requireAdmin(req, res, next) {
  const sessionId = req.cookies.admin_session;
  if (!sessionId) {
    return res.status(401).json({ error: '未登录，请先登录管理员后台' });
  }

  try {
    const sessionData = await storageService.getObject(`admin-sessions/${sessionId}.json`);
    if (!sessionData) {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }

    const session = JSON.parse(sessionData);
    if (new Date(session.expires_at) < new Date()) {
      await storageService.deleteObject(`admin-sessions/${sessionId}.json`);
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }

    // 更新过期时间 (滑动窗口)
    session.expires_at = new Date(Date.now() + 3600000).toISOString();
    await storageService.putObject(`admin-sessions/${sessionId}.json`, JSON.stringify(session));

    req.adminSession = session;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    return res.status(500).json({ error: '鉴权服务异常' });
  }
}
