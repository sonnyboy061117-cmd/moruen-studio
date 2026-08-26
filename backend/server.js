// 墨韵工坊 · Express 服务入口(同时托管前端静态 + 后端 API)
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import keysRouter from './routes/keys.js';
import generateRouter from './routes/generate.js';
import tasksRouter from './routes/tasks.js';
import fetchRouter from './routes/fetch.js';
import metaRouter from './routes/meta.js';
import './lib/keys.js'; // 触发主密钥初始化

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

// 简易登录(Basic Auth + 内存限流)
const AUTH_USER = process.env.AUTH_USER || 'moruen';
const AUTH_PASS = process.env.AUTH_PASS || 'moruen@2026';
const AUTH_REALM = 'Moruen Studio';

// 内存限流(per IP, 1 分钟 120 次)
const buckets = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const win = 60_000;
  const max = 120;
  const b = buckets.get(ip) || { count: 0, resetAt: now + win };
  if (now > b.resetAt) { b.count = 0; b.resetAt = now + win; }
  b.count++;
  buckets.set(ip, b);
  if (b.count > max) {
    res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000));
    return res.status(429).json({ error: '请求过于频繁,请稍后再试' });
  }
  next();
}

// Basic Auth
function basicAuth(req, res, next) {
  // /health 免登录(给监控用)
  if (req.path === '/health') return next();
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const [u, p] = Buffer.from(h.slice(6), 'base64').toString('utf-8').split(':');
    if (u === AUTH_USER && p === AUTH_PASS) return next();
  }
  res.setHeader('WWW-Authenticate', `Basic realm="${AUTH_REALM}", charset="UTF-8"`);
  res.status(401).send('需要登录');
}

app.use(cors({ origin: ALLOW_ORIGIN === '*' ? true : ALLOW_ORIGIN.split(',') }));
app.use(express.json({ limit: '10mb' }));

// 健康检查免登录
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// 业务路由: 限流 + Basic Auth
app.use(rateLimit);
app.use(basicAuth);
app.use('/api', keysRouter);
app.use('/api', generateRouter);
app.use('/api', tasksRouter);
app.use('/api', fetchRouter);
app.use('/api', metaRouter);

// 托管前端静态文件
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR, { index: 'index.html', maxAge: 0 }));

app.use((err, req, res, next) => {
  console.error('[ERR]', err);
  res.status(500).json({ error: err.message || '内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[moruen-backend] listening on http://0.0.0.0:${PORT}`);
  console.log(`[moruen-backend] CORS allow: ${ALLOW_ORIGIN}`);
  console.log(`[moruen-backend] serving frontend from ${FRONTEND_DIR}`);
  console.log(`[moruen-backend] Basic Auth: user='${AUTH_USER}'  (改 AUTH_USER/AUTH_PASS 环境变量)`);
});
