// 墨韵工坊 · 秘钥管理路由
import { Router } from 'express';
import { setKey, getKey, deleteKey, listKeys, isConfigured } from '../lib/keys.js';
import { testProvider } from '../lib/llm.js';
import { config } from '../lib/config.js';

const router = Router();

// 列出所有秘钥(掩码)
router.get('/keys', (req, res) => {
  const masked = listKeys();
  const out = {};
  for (const [k, v] of Object.entries(config.providers.providers)) {
    out[k] = {
      name: v.name,
      short: v.short,
      models: v.models,
      default_model: v.default_model,
      configured: isConfigured(k),
      key_masked: masked[k] || null
    };
  }
  res.json({ providers: out, default_provider: config.providers.default_provider });
});

// 保存/更新 key
router.post('/keys/:provider', (req, res) => {
  const { provider } = req.params;
  const { key } = req.body || {};
  if (!config.providers.providers[provider]) return res.status(400).json({ error: '未知供应商' });
  if (!key || !key.trim()) return res.status(400).json({ error: '密钥不能为空' });
  try {
    setKey(provider, key.trim());
    res.json({ ok: true, provider, masked: listKeys()[provider] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除 key
router.delete('/keys/:provider', (req, res) => {
  deleteKey(req.params.provider);
  res.json({ ok: true });
});

// 测试连接
router.post('/keys/:provider/test', async (req, res) => {
  const r = await testProvider(req.params.provider);
  res.json(r);
});

// 临时查看明文 key(用于 UI 显示,需二次确认)
router.post('/keys/:provider/reveal', (req, res) => {
  const { confirm } = req.body || {};
  if (!confirm) return res.status(400).json({ error: '需二次确认' });
  const k = getKey(req.params.provider);
  if (!k) return res.status(404).json({ error: '未配置' });
  res.json({ key: k });
});

export default router;
