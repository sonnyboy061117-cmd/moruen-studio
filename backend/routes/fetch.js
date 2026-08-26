// 墨韵工坊 · 链接抓取路由(后端无 CORS)
import { Router } from 'express';
import { fetchArticle } from '../lib/readability.js';

const router = Router();

router.post('/fetch', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url 必填' });
  const r = await fetchArticle(url);
  res.json(r);
});

router.post('/fetch-batch', async (req, res) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || !urls.length) return res.status(400).json({ error: 'urls 必填' });
  const out = [];
  for (const u of urls) {
    out.push(await fetchArticle(u));
  }
  res.json({ results: out });
});

export default router;
