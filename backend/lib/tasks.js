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

const tasks = new Map(); // taskId -> { meta, items, status, createdAt }

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
    updatedAt: new Date().toISOString()
  };
  tasks.set(id, task);
  return task;
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
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  tasks.set(task.id, task);
  const pool = new TaskPool(concurrency || 8);
  const selectedDomain = Array.isArray(domain) ? domain[0] : domain;

  const jobs = [];
  for (const item of items) {
    jobs.push(pool.run(async () => {
      item.status = ITEM_STATUS.GENERATING;
      task.updatedAt = new Date().toISOString();
      try {
        const text = await chat({
          provider,
          demo,
          messages: [{ role: 'user', content: buildOriginalPrompt({ topic: item.title, length, style, domain: selectedDomain, withImages }) }],
          temperature: 0.85,
          maxTokens: Math.max(1024, Math.floor(length * 2.5))
        });
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
          item.status = ITEM_STATUS.GEN_FAIL;
          item.error = e.message;
        }
      }));
  }
  await Promise.all(jobs);
  finishTask(task.id);
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
    updatedAt: new Date().toISOString()
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
  for (const item of task.items) {
    if (item.status === ITEM_STATUS.FETCH_FAIL) continue;
    jobs.push(pool.run(async () => {
      const source = cache.get(item.source);
      const angleList = logics.length ? logics : ['不同角度重写'];
      const angle = angleList[item.angle % angleList.length];
      item.status = ITEM_STATUS.GENERATING;
      task.updatedAt = new Date().toISOString();
      try {
        const text = await chat({
          provider,
          demo,
          messages: [{ role: 'user', content: buildBatchRewritePrompt({
            originalText: source.text,
            strength, logic: logics, targetLength, angle
          }) }],
          temperature: 0.85,
          maxTokens: Math.max(1024, Math.floor(source.text.length * 1.2))
        });
        let body = text.trim();
        item.body = body;
        item.status = ITEM_STATUS.GENERATED;

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
        item.status = ITEM_STATUS.GEN_FAIL;
        item.error = e.message;
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

export { ITEM_STATUS };
