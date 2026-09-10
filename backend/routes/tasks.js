// 墨韵工坊 · 批量任务路由
import { Router } from 'express';
import { runBatchOriginal, runBatchRewrite, getTask, listTasks, cancelTask, regenerateSingleItem, ITEM_STATUS } from '../lib/tasks.js';
import { config } from '../lib/config.js';
import { isConfigured } from '../lib/keys.js';
import { checkAccess, checkAndConsumeBalance } from '../lib/access.js';

const router = Router();

// 创建并启动批量原创(立即返回 taskId,后台异步跑)
router.post('/original', checkAccess, async (req, res) => {
  const { topics, perTopic, length, domain, style, withImages, withAIOff, withFormat, provider, concurrency, demo } = req.body;
  const p = provider || config.providers.default_provider;
  if (!topics || !topics.length) return res.status(400).json({ error: '请填写至少 1 个主题' });
  if (topics.length > 10) return res.status(400).json({ error: '主题最多 10 个,当前 ' + topics.length + ' 个' });
  if (topics.length * perTopic > config.prompts.max_total_articles) {
    return res.status(400).json({ error: '单次最多 ' + config.prompts.max_total_articles + ' 篇' });
  }

  // 自动演示模式或手动demo参数
  const useDemo = demo || req.autoDemo;

  // 非Demo模式且非会员，需要扣费
  if (!useDemo && !req.membership.active) {
    const totalCount = topics.length * perTopic;
    const cost = totalCount * 0.1; // 每篇约0.1元
    const consumeResult = await checkAndConsumeBalance(cost, `批量原创(${totalCount}篇)`);
    if (!consumeResult.allowed) {
      return res.status(403).json({
        error: consumeResult.error,
        code: 'INSUFFICIENT_BALANCE'
      });
    }
  }

  // 立刻创建 task 骨架并返回(不等真正跑完),让前端先开始轮询
  const { newId } = await import('../lib/tasks.js');
  const id = newId();
  // 先放一个最小骨架(让前端立刻可见),稍后 runBatchOriginal 会覆盖
  res.json({ taskId: id, task: { id, type: 'original', total: topics.length * perTopic, items: [], status: 'pending' } });
  // 后台跑(不等),用我们预先生成的 id,保证前端 polling 拿到的 id 一致
  runBatchOriginal({ topics, perTopic, length, domain, style, withImages, withAIOff, withFormat, provider: p, concurrency, demo: useDemo, taskId: id })
    .catch(e => console.error('[original] task', id, 'failed:', e.message));
});

// 创建并启动批量改写(立即返回 taskId,后台异步跑)
router.post('/rewrite', checkAccess, async (req, res) => {
  const { urls, texts, count, strength, logics, targetLength, provider, concurrency, withAIOff, demo } = req.body;
  const p = provider || config.providers.default_provider;
  const rawSources = Array.isArray(texts) ? texts : (Array.isArray(urls) ? urls : []);
  console.log('[rewrite] received sources.length=', rawSources.length, 'count=', count, 'first.text-len=', rawSources[0]?.length, 'mode=', Array.isArray(texts) ? 'text' : 'url');
  const sources = rawSources;
  if (!sources.length) return res.status(400).json({ error: '请填写至少 1 条原文/链接' });

  // 自动演示模式或手动demo参数
  const useDemo = demo || req.autoDemo;

  // 非Demo模式且非会员，需要扣费
  if (!useDemo && !req.membership.active) {
    const totalCount = sources.length * count;
    const cost = totalCount * 0.08; // 每篇约0.08元
    const consumeResult = await checkAndConsumeBalance(cost, `批量改写(${totalCount}篇)`);
    if (!consumeResult.allowed) {
      return res.status(403).json({
        error: consumeResult.error,
        code: 'INSUFFICIENT_BALANCE'
      });
    }
  }

  const { newId } = await import('../lib/tasks.js');
  const id = newId();
  res.json({ taskId: id, task: { id, type: 'rewrite', total: sources.length * count, items: [], status: 'pending' } });
  runBatchRewrite({ sources, count, strength, logics, targetLength, provider: p, concurrency, withAIOff, demo: useDemo, taskId: id })
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

// 重新生成单篇文章
router.post('/tasks/:id/items/:index/regenerate', checkAccess, async (req, res) => {
  try {
    const { id, index } = req.params;
    const itemIndex = parseInt(index);

    if (isNaN(itemIndex) || itemIndex < 0) {
      return res.status(400).json({ error: '无效的文章索引' });
    }

    const { provider, demo } = req.body;
    const p = provider || config.providers.default_provider;
    const useDemo = demo || req.autoDemo;

    // 非Demo模式且非会员，需要扣费（单篇重新生成约0.08元）
    if (!useDemo && !req.membership.active) {
      const cost = 0.08;
      const consumeResult = await checkAndConsumeBalance(cost, `重新生成单篇`);
      if (!consumeResult.allowed) {
        return res.status(403).json({
          error: consumeResult.error,
          code: 'INSUFFICIENT_BALANCE'
        });
      }
    }

    const result = await regenerateSingleItem({
      taskId: id,
      itemIndex,
      provider: p,
      demo: useDemo
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
