// 墨韵工坊 · 前端 API 客户端
// 所有调用走后端,Key 不再出现在浏览器
const BASE = window.MORUEN_API_BASE || '';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) {
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // 元数据
  meta: () => req('/api/meta'),

  // 秘钥
  keys: () => req('/api/keys'),
  saveKey: (provider, key) => req('/api/keys/' + provider, { method: 'POST', body: { key } }),
  deleteKey: (provider) => req('/api/keys/' + provider, { method: 'DELETE' }),
  testKey: (provider) => req('/api/keys/' + provider + '/test', { method: 'POST', body: {} }),
  testKeyTemp: (provider, key) => req('/api/keys/' + provider + '/test', { method: 'POST', body: { tempKey: key } }),
  revealKey: (provider, opts = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (opts.auth) headers['Authorization'] = 'Basic ' + btoa(opts.auth.user + ':' + opts.auth.pass);
    return req('/api/keys/' + provider + '/reveal', { method: 'POST', body: { confirm: true }, headers });
  },

  // 单点
  title: (body) => req('/api/title', { method: 'POST', body }),
  universal: (body) => req('/api/universal', { method: 'POST', body }),
  layout: (body) => req('/api/layout', { method: 'POST', body }),
  score: (text) => req('/api/score', { method: 'POST', body: { text } }),
  estimate: (body) => req('/api/estimate', { method: 'POST', body }),

  // 批量
  batchOriginal: (body) => req('/api/original', { method: 'POST', body }),
  batchRewrite: (body) => req('/api/rewrite', { method: 'POST', body }),
  task: (id) => req('/api/tasks/' + id),
  tasks: () => req('/api/tasks'),
  cancelTask: (id, reason) => req('/api/tasks/' + id + '/cancel', { method: 'POST', body: { reason } }),

  // 链接抓取
  fetchArticle: (url) => req('/api/fetch', { method: 'POST', body: { url } })
};
