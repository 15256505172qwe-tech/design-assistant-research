// 安全中间件：只设置安全头，不处理CORS（同域无需CORS）
export function securityMiddleware(req, res, next) {
  // 安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 不设置 CORS 头，因为前端和 API 同域
  next();
}
