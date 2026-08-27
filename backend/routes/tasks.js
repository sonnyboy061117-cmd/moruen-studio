// 墨韵工坊 · 批量任务路由
import { Router } from 'express';
import { runBatchOriginal, runBatchRewrite, getTask, listTasks, cancelTask, ITEM_STATUS } from '../lib/tasks.js';
import { config } from '../lib/config.js';
import { isConfigured } from '../lib/keys.js';

const router = Router();

// 创建并启动批量原创(立即返回 taskId,后台异步跑)
router.post('/original', async (req, res) => {
  const { topics, perTopic, length, domain, style, withImages, withAIOff, withFormat, provider, concurrency, demo } = req.body;
  const p = provider || config.providers.default_provider;
  if (!demo && !isConfigured(p)) return res.status(400).json({ error: '请先配置 ' + config.providers.providers[p].name + ' 的 API Key' });
  if (!topics || !topics.length) return res.status(400).json({ error: '请填写至少 1 个主题' });
  if (topics.length > 10) return res.status(400).json({ error: '主题最多 10 个,当前 ' + topics.length + ' 个' });
  if (topics.length * perTopic > config.prompts.max_total_articles) {
    return res.status(400).json({ error: '单次最多 ' + config.prompts.max_total_articles + ' 篇' });
  }
  // 立刻创建 task 骨架并返回(不等真正跑完),让前端先开始轮询
  const { newId } = await import('../lib/tasks.js');
  const id = newId();
  // 先放一个最小骨架(让前端立刻可见),稍后 runBatchOriginal 会覆盖
  res.json({ taskId: id, task: { id, type: 'original', total: topics.length * perTopic, items: [], status: 'pending' } });
  // 后台跑(不等),用我们预先生成的 id,保证前端 polling 拿到的 id 一致
  runBatchOriginal({ topics, perTopic, length, domain, style, withImages, withAIOff, withFormat, provider: p, concurrency, demo: !!demo, taskId: id })
    .catch(e => console.error('[original] task', id, 'failed:', e.message));
});

// 创建并启动批量改写(立即返回 taskId,后台异步跑)
router.post('/rewrite', async (req, res) => {
  const { urls, texts, count, strength, logics, targetLength, provider, concurrency, withAIOff, demo } = req.body;
  const p = provider || config.providers.default_provider;
  const rawSources = Array.isArray(texts) ? texts : (Array.isArray(urls) ? urls : []);
  console.log('[rewrite] received sources.length=', rawSources.length, 'count=', count, 'first.text-len=', rawSources[0]?.length, 'mode=', Array.isArray(texts) ? 'text' : 'url');
  if (!demo && !isConfigured(p)) return res.status(400).json({ error: '请先配置 ' + config.providers.providers[p].name + ' 的 API Key' });
  const sources = rawSources;
  if (!sources.length) return res.status(400).json({ error: '请填写至少 1 条原文/链接' });
  const { newId } = await import('../lib/tasks.js');
  const id = newId();
  res.json({ taskId: id, task: { id, type: 'rewrite', total: sources.length * count, items: [], status: 'pending' } });
  runBatchRewrite({ sources, count, strength, logics, targetLength, provider: p, concurrency, withAIOff, demo: !!demo, taskId: id })
    .catch(e => console.error('[rewrite] task', id, 'failed:', e.message));
});

// 轮询任务状态
router.get('/tasks/:id', (req, res) => {
  const t = getTask(req.params.id);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  res.json(t);
});

// 列出最近任务
router.get('/tasks', (req, res) => {
  res.json({ tasks: listTasks() });
});

// 取消任务
router.post('/tasks/:id/cancel', (req, res) => {
  const result = cancelTask(req.params.id, req.body.reason);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/status-enum', (req, res) => {
  res.json(ITEM_STATUS);
});

export default router;
