// EdgeOne Cloud Functions 入口
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 路由
import authRoutes from '../../src/routes/auth.js';
import chatRoutes from '../../src/routes/chat.js';
import adminRoutes from '../../src/routes/admin.js';
import uploadRoutes from '../../src/routes/upload.js';
import { requireAdmin } from '../../src/middleware/auth.js';
import { securityMiddleware } from '../../src/middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 中间件
app.use(securityMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 静态文件 (前端)
app.use(express.static(join(__dirname, '../../../public')));

// 健康检查
app.get('/health', (req, res) => res.send('ok'));

// API路由 - 注意：这些路由会挂载到 /api 前缀下
app.use('/api', authRoutes);      // authRoutes 定义 router.post('/validate', ...)
app.use('/api', chatRoutes);      // chatRoutes 定义 router.post('/chat', ...) 和 router.get('/history', ...)
app.use('/api', uploadRoutes);    // uploadRoutes 定义 router.post('/upload-image', ...)
app.use('/api/admin', adminRoutes); // adminRoutes 定义 router.post('/login', ...) 等

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: '服务器内部错误，请稍后重试' });
});

// EdgeOne 要求 export default app
export default app;
