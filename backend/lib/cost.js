// 墨韵工坊 · 成本预估
// 接入真实单价,从 providers.json 读取
import { config } from './config.js';

export function estimateCost({ provider, totalCount, wordsPerItem, withAIOff }) {
  const p = config.providers.providers[provider];
  if (!p) return 0;
  // 粗估: 输入 tokens ≈ 0.6 × 字数,输出 tokens ≈ 1.2 × 字数(降 AI 味更费)
  const inputTokensPerItem = wordsPerItem * 0.6;
  const outputTokensPerItem = wordsPerItem * 1.2 * (withAIOff ? 2.5 : 1.0); // 降 AI 味 4 阶段 2-3 倍
  const totalTokens = totalCount * (inputTokensPerItem + outputTokensPerItem);
  const cost = (totalTokens / 1000) * p.cost_per_1k_tokens;
  return Math.round(cost * 1000) / 1000; // 3 位小数
}
