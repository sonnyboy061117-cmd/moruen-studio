// 墨韵工坊 · 启发式打分(可配置版)
// 权重/阈值从 config/scoring.json 读取,改配置重启生效,无需改代码
import { config } from './config.js';

function splitSentences(text) {
  return text.replace(/\r/g, '').split(/(?<=[。！？!?\.\n])/).map(s => s.trim()).filter(Boolean);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scoreAI(text) {
  if (!text || text.length < 30) return { score: 0, level: 'unknown', breakdown: {} };
  const cfg = config.scoring;
  const w = cfg.weights;
  const breakdown = {};
  let penalty = 0;

  // 1. 模板短语命中
  let tmplHits = 0;
  for (const p of cfg.template_phrases) {
    const re = new RegExp(escapeRe(p), 'g');
    const m = text.match(re);
    if (m) tmplHits += m.length;
  }
  breakdown.templateHits = tmplHits;
  penalty += Math.min(tmplHits * w.template_penalty_each, w.template_penalty_cap);

  // 2. 句长方差
  const sents = splitSentences(text);
  const sentLens = sents.map(s => s.length).filter(n => n > 0);
  const mean = sentLens.reduce((a, b) => a + b, 0) / sentLens.length;
  const variance = sentLens.reduce((a, b) => a + (b - mean) ** 2, 0) / sentLens.length;
  const std = Math.sqrt(variance);
  const uniformity = 1 / (1 + std / 8);
  breakdown.sentLengthStd = std.toFixed(1);
  breakdown.uniformity = (uniformity * 100).toFixed(0) + '%';
  penalty += uniformity * w.uniformity_weight;

  // 3. 段落重复开头
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const prefixMap = {};
  for (const p of paragraphs) {
    const head = p.slice(0, 6);
    prefixMap[head] = (prefixMap[head] || 0) + 1;
  }
  let pRepeats = 0;
  for (const k in prefixMap) {
    if (prefixMap[k] >= 2) pRepeats += (prefixMap[k] - 1);
  }
  breakdown.paragraphPrefixRepeats = pRepeats;
  penalty += Math.min(pRepeats * w.paragraph_repeat_each, w.paragraph_repeat_cap);

  // 4. 过渡词
  let trans = 0;
  for (const t of cfg.transition_words) {
    const re = new RegExp(escapeRe(t), 'g');
    const m = text.match(re);
    if (m) trans += m.length;
  }
  breakdown.transitionHits = trans;
  penalty += Math.min(trans * w.transition_each, w.transition_cap);

  // 5. 第一人称 (加分)
  let persona = 0;
  for (const t of cfg.persona_tokens) {
    const re = new RegExp(escapeRe(t), 'g');
    const m = text.match(re);
    if (m) persona += m.length;
  }
  breakdown.personaHits = persona;
  penalty -= Math.min(persona * w.persona_bonus_each, w.persona_bonus_cap);

  // 6. 口语词 (加分)
  let col = 0;
  for (const t of cfg.colloquial_tokens) {
    const re = new RegExp(escapeRe(t), 'g');
    const m = text.match(re);
    if (m) col += m.length;
  }
  breakdown.colloquialHits = col;
  penalty -= Math.min(col * w.colloquial_bonus_each, w.colloquial_bonus_cap);

  // 7. 长句惩罚
  breakdown.avgSentLen = mean.toFixed(1);
  if (mean > w.long_sentence_threshold) penalty += (mean - w.long_sentence_threshold) * w.long_sentence_per_char;
  if (mean < w.short_sentence_threshold) penalty += w.short_sentence_penalty;

  // 8. 标点堆叠
  const weirdPunct = (text.match(/[!?。]{2,}/g) || []).length;
  breakdown.weirdPunct = weirdPunct;
  penalty += weirdPunct * w.weird_punct_each;

  const score = Math.max(0, Math.min(100, Math.round(penalty + w.base_score)));
  let level = 'human';
  if (score >= 70) level = 'strong-ai';
  else if (score >= 50) level = 'medium-ai';
  else if (score >= 30) level = 'low-ai';

  return { score, level, breakdown, threshold: cfg.pass_threshold, passed: score < cfg.pass_threshold };
}
