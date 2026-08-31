// 墨韵工坊 · 元数据路由(给前端加载配置)
import { Router } from 'express';
import { config } from '../lib/config.js';

const router = Router();

router.get('/meta', (req, res) => {
  res.json({
    domains: config.domains.domains,
    strengths: config.strengths,
    styles: config.styles,
    prompts: config.prompts,
    providers: Object.fromEntries(
      Object.entries(config.providers.providers).map(([k, v]) => [k, {
        name: v.name,
        short: v.short,
        models: v.models,
        default_model: v.default_model,
        default_configured: v.default_configured,
        type: v.type
      }])
    ),
    default_provider: config.providers.default_provider,
    scoring_pass_threshold: config.scoring.pass_threshold
  });
});

export default router;
