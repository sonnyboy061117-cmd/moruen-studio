// 墨韵工坊 · 单点生成 API(标题/万能改写/排版/打分)
import { Router } from 'express';
import { chat } from '../lib/llm.js';
import { runDeAI } from '../lib/deai.js';
import { scoreAI } from '../lib/scoring.js';
import { estimateCost } from '../lib/cost.js';
import { config } from '../lib/config.js';
import { buildTitlePrompt, buildUniversalPrompt } from '../lib/prompts.js';
import { isConfigured } from '../lib/keys.js';

const router = Router();

function pickProvider(req) {
  return req.body?.provider || config.providers.default_provider;
}

function ensureKey(provider, res) {
  if (!isConfigured(provider)) {
    res.status(400).json({ error: '请先在「模型秘钥」配置 ' + config.providers.providers[provider].name + ' 的 API Key' });
    return false;
  }
  return true;
}

// 1. 一键标题
router.post('/title', async (req, res) => {
  const { refs, count, domain, style, format, provider, demo } = req.body;
  const p = provider || config.providers.default_provider;
  if (!demo && !ensureKey(p, res)) return;
  try {
    const text = await chat({
      provider: p,
      demo: !!demo,
      messages: [{ role: 'user', content: buildTitlePrompt({ refs, count, domain, style, format }) }],
      temperature: 0.95, maxTokens: 1024
    });
    const titles = parseListOutput(text, count);
    res.json({ titles, cost: estimateCost({ provider: p, totalCount: 1, wordsPerItem: 0.5, withAIOff: false }) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. 万能改写(含"仅降 AI 味")
router.post('/universal', async (req, res) => {
  const { text, strength, audience, aiOff, keywords, tone, length, onlyDeAI, provider, demo } = req.body;
  const p = provider || config.providers.default_provider;
  if (!demo && !ensureKey(p, res)) return;
  try {
    let finalText;
    if (onlyDeAI) {
      const r = await runDeAI({ text, provider: p, demo: !!demo });
      finalText = r.text;
    } else {
      const prompt = buildUniversalPrompt({ text, strength, audience, keywords, tone, length, onlyDeAI: false });
      const out = await chat({
        provider: p,
        demo: !!demo,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85, maxTokens: Math.max(1024, Math.floor(text.length * 1.5))
      });
      finalText = out.trim();
      if (aiOff) {
        const r = await runDeAI({ text: finalText, provider: p, demo: !!demo });
        finalText = r.text;
      }
    }
    const sc = scoreAI(finalText);
    res.json({ text: finalText, score: sc.score, level: sc.level, threshold: sc.threshold, passed: sc.passed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. 一键排版
router.post('/layout', async (req, res) => {
  const { text, style, size, line, withImages, withEmoji, withQuote, withAI, provider } = req.body;
  const p = provider || config.providers.default_provider;
  try {
    let working = text;
    if (withAI && ensureKey(p, res)) {
      const r = await runDeAI({ text: working, provider: p });
      working = r.text;
    }
    const { html, title } = layoutText({ text: working, style, size, line, withImages, withEmoji, withQuote });
    res.json({ html, title });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. 单点打分(用于前端调试)
router.post('/score', (req, res) => {
  const { text } = req.body;
  const r = scoreAI(text);
  res.json(r);
});

// 5. 成本预估
router.post('/estimate', (req, res) => {
  const { provider, totalCount, wordsPerItem, withAIOff } = req.body;
  res.json({ cost: estimateCost({ provider, totalCount, wordsPerItem, withAIOff }) });
});

function parseListOutput(text, expected) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    let t = l.replace(/^\d+[\.\)、]\s*/, '').replace(/^[-*•]\s*/, '').replace(/^#+\s*/, '').trim();
    if (t.length < 4 || t.length > 60) continue;
    if (/^生成|以上|下面|以下|请|注意|说明|这里|下面我|好的|没问题|当然/.test(t)) continue;
    out.push(t);
    if (out.length >= expected) break;
  }
  return out;
}

function layoutText({ text, style, size, line, withImages, withEmoji, withQuote }) {
  const themeMap = Object.fromEntries(config.styles.layout_styles.map(s => [s.key, s]));
  const t = themeMap[style] || themeMap['简约'];
  const fontSize = (config.styles.font_sizes.find(s => s.key === size) || { px: 15 }).px;
  const lineHeight = (config.styles.line_heights.find(l => l.key === line) || { val: 1.75 }).val;

  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  let html = `<div style="font-family:${t.font},'Noto Serif SC','Noto Sans SC',serif;color:${t.color};background:${t.bg};line-height:${lineHeight};padding:24px 20px;border-radius:10px;max-width:680px;margin:0 auto;">`;
  const firstPara = paragraphs[0] || '';
  let title = firstPara.length <= 28 ? firstPara : (style + '风格排版');
  if (firstPara.length <= 28) paragraphs.shift();
  html += `<h2 style="font-family:'Noto Serif SC',serif;text-align:center;color:${t.accent};font-size:${fontSize + 6}px;font-weight:700;margin:0 0 18px;padding-bottom:14px;border-bottom:2px solid ${t.accent};letter-spacing:0.02em;">${escapeHtml(title)}</h2>`;
  paragraphs.forEach((p, i) => {
    let content = p;
    if (withEmoji && i % 3 === 0 && i > 0) {
      const emojis = ['📌', '💡', '⚠️', '✨', '🎯', '🔑'];
      content = emojis[i % emojis.length] + ' ' + content;
    }
    if (withQuote && /["「"]/.test(content) && content.length < 60) {
      html += `<blockquote style="margin:14px 0;padding:12px 16px;border-left:4px solid ${t.accent};background:rgba(0,0,0,0.02);font-style:italic;color:${t.accent};font-size:${fontSize}px;">${escapeHtml(content)}</blockquote>`;
    } else if (i === 0) {
      html += `<p style="font-weight:600;font-size:${fontSize + 0.5}px;margin:0 0 14px;">${escapeHtml(content)}</p>`;
    } else {
      html += `<p style="text-indent:2em;margin:0 0 12px;font-size:${fontSize}px;">${escapeHtml(content)}。</p>`;
    }
    if (withImages && i === Math.floor(paragraphs.length / 2)) {
      html += `<div style="text-align:center;margin:18px 0;padding:22px;background:linear-gradient(135deg,${t.accent}22,${t.accent}11);border-radius:8px;color:${t.accent};font-size:13px;border:1px dashed ${t.accent}55;">🖼️ 配图位 · AI 生图或图库适配 4:3</div>`;
    }
  });
  html += `<div style="text-align:center;margin-top:20px;padding-top:14px;border-top:1px dashed ${t.accent}55;font-size:11.5px;color:#999;">— 由墨韵工坊生成 · 一键复制到公众号 —</div>`;
  html += `</div>`;
  return { html, title };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default router;
