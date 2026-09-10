// 墨韵工坊 · 批量任务管理器
// 状态机: 待生成 → 生成中 → 生成成功 → 降AI处理中 → 降AI处理成功 / 降AI处理失败(未达标)
// 异常: 抓取失败(批量改写) / 生成失败
// 内存维护,前端轮询

import { TaskPool } from './pool.js';
import { chat } from './llm.js';
import { runDeAI } from './deai.js';
import { fetchArticle } from './readability.js';
import { scoreAI } from './scoring.js';
import { config } from './config.js';
import { buildOriginalPrompt, buildBatchRewritePrompt } from './prompts.js';
import { checkSimilarity } from './similarity.js';

// 单任务状态
const ITEM_STATUS = {
  PENDING: '待生成',
  GENERATING: '生成中',
  GENERATED: '生成成功',
  DEAI_RUNNING: '降AI处理中',
  DEAI_OK: '降AI处理成功',
  DEAI_FAIL: '降AI处理失败(未达标)',
  FETCH_FAIL: '抓取失败',
  GEN_FAIL: '生成失败',
  DONE: '完成'
};

const tasks = new Map(); // taskId -> { meta, items, status, createdAt, cancelToken }
const TASK_TTL = 7 * 24 * 60 * 60 * 1000; // 7天
const MAX_TASKS = 1000; // 最大保留任务数

// 任务取消令牌
class CancelToken {
  constructor() {
    this.cancelled = false;
    this.reason = null;
  }
  cancel(reason = '用户取消') {
    this.cancelled = true;
    this.reason = reason;
  }
  throwIfCancelled() {
    if (this.cancelled) {
      throw new Error(`任务已取消: ${this.reason}`);
    }
  }
}

// 定期清理过期任务
setInterval(() => {
  const now = Date.now();
  const all = Array.from(tasks.entries());
  let deleted = 0;

  // 清理超过 TTL 的任务
  for (const [id, task] of all) {
    const age = now - new Date(task.createdAt).getTime();
    if (age > TASK_TTL) {
      tasks.delete(id);
      deleted++;
    }
  }

  // 如果任务数超过上限，删除最老的已完成任务
  if (tasks.size > MAX_TASKS) {
    const sortedTasks = Array.from(tasks.entries())
      .filter(([_, t]) => t.status === 'done')
      .sort((a, b) => new Date(a[1].createdAt) - new Date(b[1].createdAt));

    const toDelete = tasks.size - MAX_TASKS;
    for (let i = 0; i < toDelete && i < sortedTasks.length; i++) {
      tasks.delete(sortedTasks[i][0]);
      deleted++;
    }
  }

  if (deleted > 0) {
    console.log(`[任务清理] 已清理 ${deleted} 个过期/超量任务，当前保留 ${tasks.size} 个`);
  }
}, 30 * 60 * 1000); // 每30分钟清理一次

export function newId() { return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function createTask({ type, total }) {
  const id = newId();
  const items = [];
  for (let i = 0; i < total; i++) {
    items.push({ id: i + 1, status: ITEM_STATUS.PENDING, title: '', body: '', score: null, error: null });
  }
  const task = {
    id, type, total,
    items,
    status: 'running',
    success: 0, fail: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelToken: new CancelToken()
  };
  tasks.set(id, task);
  return task;
}

export function cancelTask(taskId, reason = '用户取消') {
  const task = tasks.get(taskId);
  if (!task) {
    return { success: false, message: '任务不存在' };
  }
  if (task.status === 'cancelled') {
    return { success: false, message: '任务已取消' };
  }
  // 允许取消已完成的任务（将未处理的项标记为已取消）
  task.cancelToken.cancel(reason);
  task.status = 'cancelled';
  // 将所有未完成的项标记为已取消
  task.items.forEach(item => {
    if (item.status === ITEM_STATUS.PENDING ||
        item.status === ITEM_STATUS.GENERATING ||
        item.status === ITEM_STATUS.DEAI_RUNNING) {
      item.status = ITEM_STATUS.CANCELLED;
      item.error = '任务已取消: ' + reason;
    }
  });
  task.updatedAt = new Date().toISOString();
  return { success: true, message: '任务已取消' };
}

export function getTask(id) {
  return tasks.get(id);
}

export function listTasks() {
  return Array.from(tasks.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateItem(taskId, itemId, patch) {
  const t = tasks.get(taskId);
  if (!t) return;
  const item = t.items.find(i => i.id === itemId);
  if (!item) return;
  Object.assign(item, patch);
  t.updatedAt = new Date().toISOString();
}

export function finishTask(taskId) {
  const t = tasks.get(taskId);
  if (!t) return;
  t.status = 'done';
  t.success = t.items.filter(i => i.status === ITEM_STATUS.DONE || i.status === ITEM_STATUS.DEAI_OK).length;
  t.fail = t.items.filter(i => i.status === ITEM_STATUS.GEN_FAIL || i.status === ITEM_STATUS.FETCH_FAIL).length;
  t.updatedAt = new Date().toISOString();
}

// 跑批量原创任务
export async function runBatchOriginal({ topics, perTopic, length, domain, style, withImages, withAIOff, withFormat, provider, concurrency, demo = false, taskId = null }) {
  // 先建任务骨架(每个 item 用 topic#i 作为稳定 id,后续 update 直接用)
  const id = taskId || newId();
  const items = [];
  for (const topic of topics) {
    for (let i = 0; i < perTopic; i++) {
      items.push({ id: topic + '#' + (i + 1), title: topic, body: '', score: null, status: ITEM_STATUS.PENDING, error: null });
    }
  }
  const task = {
    id, type: 'original',
    total: items.length, items,
    status: 'running', success: 0, fail: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    cancelToken: new CancelToken()
  };
  tasks.set(task.id, task);
  const pool = new TaskPool(concurrency || 8);
  const selectedDomain = Array.isArray(domain) ? domain[0] : domain;

  const jobs = [];
  for (const item of items) {
    jobs.push(pool.run(async () => {
      try {
        // 检查任务是否被取消
        task.cancelToken.throwIfCancelled();

        item.status = ITEM_STATUS.GENERATING;
        task.updatedAt = new Date().toISOString();

        // 重试机制：最多3次
        let lastError = null;
        let text = null;

        for (let retry = 0; retry < 3; retry++) {
          try {
            task.cancelToken.throwIfCancelled();

            text = await chat({
              provider,
              demo,
              messages: [{ role: 'user', content: buildOriginalPrompt({ topic: item.title, length, style, domain: selectedDomain, withImages }) }],
              temperature: 0.85,
              maxTokens: Math.max(1024, Math.floor(length * 2.5))
            });
            break; // 成功则退出重试循环
          } catch (e) {
            lastError = e;
            if (e.message.includes('任务已取消')) {
              throw e; // 如果是取消错误，直接抛出
            }
            if (retry < 2) {
              console.log(`[重试] 任务 ${task.id} 项 ${item.id} 第 ${retry + 1} 次失败，等待重试: ${e.message}`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // 指数退避
            }
          }
        }

        if (!text) {
          throw lastError || new Error('生成失败');
        }

        let body = text.trim();
        // 后端硬截断: 超出 length*1.3 强制截断,防止 LLM 跑偏
        const maxLen = Math.floor(length * 1.3);
        if (body.length > maxLen) {
          // 尽量在最后一个段落结尾截断
          const cut = body.slice(0, maxLen);
          const lastP = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('\n'), cut.lastIndexOf('！'), cut.lastIndexOf('?'));
          body = (lastP > maxLen * 0.7 ? cut.slice(0, lastP + 1) : cut) + '\n\n(系统已根据字数设置自动截断,原文超出范围)';
        }
        item.body = body;
        item.status = ITEM_STATUS.GENERATED;

        task.cancelToken.throwIfCancelled();

        if (withAIOff) {
          item.status = ITEM_STATUS.DEAI_RUNNING;
          const r = await runDeAI({ text: body, provider, demo });
          body = r.text;
          item.score = r.score;
          item.body = body;
          item.status = r.passed ? ITEM_STATUS.DEAI_OK : ITEM_STATUS.DEAI_FAIL;
        } else {
            const sc = scoreAI(body);
            item.score = sc.score;
            item.status = ITEM_STATUS.DONE;
          }
        } catch (e) {
          if (e.message.includes('任务已取消')) {
            item.status = '已取消';
            item.error = e.message;
          } else {
            item.status = ITEM_STATUS.GEN_FAIL;
            item.error = e.message;
          }
        }
      }));
  }
  await Promise.all(jobs);
  // 检查任务是否在执行过程中被取消
  if (task.cancelToken.cancelled) {
    task.status = 'cancelled';
  } else {
    finishTask(task.id);
  }
  return task;
}

// 跑批量改写任务
// sources: 字符串数组 - 若是 URL(http://)则去抓,否则当文本直接用
export async function runBatchRewrite({ sources, urls, count, strength, logics, targetLength, provider, concurrency, withAIOff = true, demo = false, taskId = null }) {
  const list = Array.isArray(sources) ? sources : (Array.isArray(urls) ? urls : []);
  const isUrl = (s) => /^https?:\/\//i.test((s || '').trim());
  // 先建立任务骨架
  const allItems = [];
  for (const src of list) {
    for (let i = 0; i < count; i++) {
      allItems.push({ id: src.slice(0, 40) + '#' + (i + 1), source: src, angle: i, status: ITEM_STATUS.PENDING });
    }
  }
  const task = {
    id: taskId || newId(),
    type: 'rewrite',
    total: allItems.length,
    items: allItems,
    status: 'running',
    success: 0, fail: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelToken: new CancelToken()
  };
  tasks.set(task.id, task);
  const pool = new TaskPool(concurrency || 8);

  // 抓取 URL 源;纯文本源直接用
  const cache = new Map(); // src -> { ok, text, title, message }
  for (const src of list) {
    if (cache.has(src)) continue;
    if (!isUrl(src)) {
      cache.set(src, { ok: true, text: src, title: '原文 ' + (cache.size + 1) });
      continue;
    }
    updateItemByCondition(task, it => it.source === src, { status: '抓取中…' });
    const f = await fetchArticle(src);
    cache.set(src, f);
    if (!f.ok) {
      for (const item of task.items) {
        if (item.source === src) {
          item.status = ITEM_STATUS.FETCH_FAIL;
          item.error = f.message;
        }
      }
    } else {
      for (const item of task.items) {
        if (item.source === src) {
          item.title = f.title;
          item.sourceText = f.text;
        }
      }
    }
  }

  // 并发改写
  const jobs = [];
  // 追踪每个源文章的已使用开篇词（按源分组）
  const usedOpeningsBySource = new Map();

  for (const item of task.items) {
    if (item.status === ITEM_STATUS.FETCH_FAIL) continue;
    jobs.push(pool.run(async () => {
      try {
        task.cancelToken.throwIfCancelled();

        const source = cache.get(item.source);
        const angleList = (logics && logics.length) ? logics : ['不同角度重写'];
        const angle = angleList[item.angle % angleList.length];
        item.status = ITEM_STATUS.GENERATING;
        task.updatedAt = new Date().toISOString();

        // 获取当前源已使用的开篇词
        if (!usedOpeningsBySource.has(item.source)) {
          usedOpeningsBySource.set(item.source, []);
        }
        const usedOpenings = usedOpeningsBySource.get(item.source);

        // 重试机制：最多3次
        let lastError = null;
        let text = null;

        for (let retry = 0; retry < 3; retry++) {
          try {
            task.cancelToken.throwIfCancelled();

            text = await chat({
              provider,
              demo,
              messages: [{ role: 'user', content: buildBatchRewritePrompt({
                originalText: source.text,
                strength,
                logic: logics,
                targetLength,
                angle,
                versionIndex: item.angle,  // 传入版本索引（0, 1, 2）
                usedOpenings: usedOpenings  // 传入已使用的开篇词
              }) }],
              temperature: 0.85,
              maxTokens: Math.max(1024, Math.floor(source.text.length * 1.2))
            });
            break;
          } catch (e) {
            lastError = e;
            if (e.message.includes('任务已取消')) {
              throw e;
            }
            if (retry < 2) {
              console.log(`[重试] 任务 ${task.id} 项 ${item.id} 第 ${retry + 1} 次失败，等待重试: ${e.message}`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
            }
          }
        }

        if (!text) {
          throw lastError || new Error('生成失败');
        }

        let body = text.trim();

        // 提取开篇前6个字并记录
        const opening = body.replace(/^【.*?】\s*/, '').substring(0, 6);
        usedOpenings.push(opening);

        item.body = body;
        item.status = ITEM_STATUS.GENERATED;

        task.cancelToken.throwIfCancelled();

        // 相似度检测
        const similarityReport = checkSimilarity(source.text, body);
        item.similarity = {
          score: similarityReport.overallScore,
          structure: similarityReport.structureScore,
          sentence: similarityReport.sentenceScore,
          vocab: similarityReport.vocabScore,
          passed: similarityReport.passed,
          warnings: similarityReport.warnings
        };

        // 如果相似度过高，添加警告标记（但不阻止流程）
        if (!similarityReport.passed) {
          item.similarityWarning = `相似度${similarityReport.overallScore}%过高，建议重新生成`;
        }

        task.cancelToken.throwIfCancelled();

        if (withAIOff) {
          item.status = ITEM_STATUS.DEAI_RUNNING;
          const r = await runDeAI({ text: body, provider, demo });
          body = r.text;
          item.score = r.score;
          item.body = body;
          item.status = r.passed ? ITEM_STATUS.DEAI_OK : ITEM_STATUS.DEAI_FAIL;
        } else {
          const sc = scoreAI(body);
          item.score = sc.score;
          item.status = ITEM_STATUS.DONE;
        }
      } catch (e) {
        if (e.message.includes('任务已取消')) {
          item.status = '已取消';
          item.error = e.message;
        } else {
          item.status = ITEM_STATUS.GEN_FAIL;
          item.error = e.message;
        }
      }
      task.updatedAt = new Date().toISOString();
    }));
  }
  await Promise.all(jobs);
  finishTask(task.id);
  return task;
}

function updateItemByCondition(task, pred, patch) {
  for (const item of task.items) {
    if (pred(item)) Object.assign(item, patch);
  }
  task.updatedAt = new Date().toISOString();
}

// 重新生成单篇文章
export async function regenerateSingleItem({ taskId, itemIndex, provider, demo }) {
  const task = tasks.get(taskId);
  if (!task) throw new Error('任务不存在');
  if (!task.items[itemIndex]) throw new Error('文章索引无效');

  const item = task.items[itemIndex];

  // 检查重试次数限制
  if (!item.retryCount) item.retryCount = 0;
  if (item.retryCount >= 3) {
    throw new Error('已达到最大重试次数(3次)');
  }

  // 获取源文本
  const cache = new Map();
  if (task.type === 'rewrite') {
    // 对于批量改写，需要从 item.sourceText 或重新抓取
    if (item.sourceText) {
      cache.set(item.source, { text: item.sourceText, title: item.title });
    } else if (item.source.startsWith('http')) {
      const f = await fetchArticle(item.source);
      if (!f.ok) throw new Error(f.message);
      cache.set(item.source, { text: f.text, title: f.title });
    } else {
      cache.set(item.source, { text: item.source, title: '' });
    }
  } else {
    throw new Error('不支持的任务类型');
  }

  const source = cache.get(item.source);
  if (!source) throw new Error('未找到源文章');

  // 收集同源的其他已生成文章的开篇词
  const usedOpenings = task.items
    .filter(it => it.source === item.source && it !== item && it.body)
    .map(it => {
      const opening = it.body.replace(/^【.*?】\s*/, '').substring(0, 6);
      return opening;
    });

  // 获取任务参数
  const { strength, logics, targetLength } = task.meta || {};
  const angleList = (logics && logics.length) ? logics : ['不同角度重写'];
  const angle = angleList[item.angle % angleList.length];

  // 标记为生成中
  item.status = ITEM_STATUS.GENERATING;
  item.error = null;
  task.updatedAt = new Date().toISOString();

  try {
    // 调用 LLM 生成
    const text = await chat({
      provider,
      demo,
      messages: [{ role: 'user', content: buildBatchRewritePrompt({
        originalText: source.text,
        strength,
        logic: logics,
        targetLength,
        angle,
        versionIndex: item.angle,  // 保持原来的版本索引
        usedOpenings: usedOpenings  // 传入其他版本已使用的开篇词
      }) }],
      temperature: 0.85,
      maxTokens: Math.max(1024, Math.floor(source.text.length * 1.2))
    });

    let body = text.trim();
    item.body = body;
    item.status = ITEM_STATUS.GENERATED;

    // 相似度检测
    const similarityReport = checkSimilarity(source.text, body);
    item.similarity = {
      score: similarityReport.overallScore,
      structure: similarityReport.structureScore,
      sentence: similarityReport.sentenceScore,
      vocab: similarityReport.vocabScore,
      passed: similarityReport.passed,
      warnings: similarityReport.warnings
    };

    // 检查与同源其他版本的相似度
    const sameSourceItems = task.items.filter(it => it.source === item.source && it !== item && it.body);
    if (sameSourceItems.length > 0) {
      const crossChecks = sameSourceItems.map(other => {
        const crossReport = checkSimilarity(body, other.body);
        return {
          withIndex: task.items.indexOf(other),
          score: crossReport.overallScore,
          passed: crossReport.passed
        };
      });

      const maxCrossSim = Math.max(...crossChecks.map(c => c.score));
      if (maxCrossSim > 65) {
        item.similarityWarning = `与其他版本相似度 ${maxCrossSim}% 过高，建议重新生成`;
        item.similarity.passed = false;
      }
    }

    // 增加重试计数
    item.retryCount = (item.retryCount || 0) + 1;
    task.updatedAt = new Date().toISOString();

    return { success: true, item };

  } catch (error) {
    item.status = ITEM_STATUS.GEN_FAIL;
    item.error = error.message;
    item.retryCount = (item.retryCount || 0) + 1;
    task.updatedAt = new Date().toISOString();
    throw error;
  }
}

export { ITEM_STATUS };
