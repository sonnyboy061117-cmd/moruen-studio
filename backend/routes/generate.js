// 墨韵工坊 · 单点生成 API(标题/万能改写/排版/打分)
import { Router } from 'express';
import { chat } from '../lib/llm.js';
import { runDeAI } from '../lib/deai.js';
import { scoreAI } from '../lib/scoring.js';
import { estimateCost } from '../lib/cost.js';
import { config } from '../lib/config.js';
import { buildTitlePrompt, buildUniversalPrompt } from '../lib/prompts.js';
import { isConfigured, getKey } from '../lib/keys.js';

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
  const { text, style, size, line, withImages, withEmoji, withQuote, withAI, withAutoImages, provider } = req.body;
  const p = provider || config.providers.default_provider;
  try {
    let working = text;
    if (withAI && ensureKey(p, res)) {
      const r = await runDeAI({ text: working, provider: p });
      working = r.text;
    }

    // 自动配图功能
    let imagePaths = [];
    if (withAutoImages) {
      try {
        // 从后端加密存储中读取通义万相密钥
        const imageKey = getKey('tongyi-wanxiang');
        if (!imageKey) {
          throw new Error('未配置通义万相API密钥');
        }
        const { generateArticleImages } = await import('../lib/image-gen.js');

        // 创建LLM客户端对象，用于分析文章生成配图场景描述
        // 强制使用文本模型（不使用图片模型），确保使用已配置的文本provider
        let textProvider = p;
        const providerConfig = config.providers.providers[p];
        if (providerConfig && providerConfig.type === 'image') {
          // 如果当前provider是图片模型，使用默认文本模型
          textProvider = config.providers.default_provider;
          // 如果默认provider也是图片模型，回退到第一个可用的文本模型
          const defaultConfig = config.providers.providers[textProvider];
          if (defaultConfig && defaultConfig.type === 'image') {
            // 查找第一个配置的文本模型
            for (const [providerKey, providerInfo] of Object.entries(config.providers.providers)) {
              if (providerInfo.type !== 'image' && isConfigured(providerKey)) {
                textProvider = providerKey;
                break;
              }
            }
          }
        }

        const llmClient = {
          chat: async (messages) => {
            return await chat({
              provider: textProvider,
              messages: messages,
              temperature: 0.7,
              maxTokens: 1024
            });
          }
        };

        imagePaths = await generateArticleImages(working, llmClient, imageKey);
      } catch (imgErr) {
        console.warn('自动配图失败:', imgErr.message);
        // 配图失败不影响排版，继续处理
      }
    }

    const { html, title } = layoutText({ text: working, style, size, line, withImages, withEmoji, withQuote, imagePaths });
    res.json({ html, title, imageGenerated: imagePaths.length > 0 });
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

function layoutText({ text, style, size, line, withImages, withEmoji, withQuote, imagePaths = [] }) {
  const themeMap = Object.fromEntries(config.styles.layout_styles.map(s => [s.key, s]));
  const t = themeMap[style] || themeMap['简约'];
  const fontSize = (config.styles.font_sizes.find(s => s.key === size) || { px: 15 }).px;
  const lineHeight = (config.styles.line_heights.find(l => l.key === line) || { val: 1.75 }).val;

  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);

  // 使用section标签作为容器，公众号兼容性更好
  let html = `<section style="font-family:${t.font},'Noto Serif SC','Noto Sans SC',serif;color:${t.color};background-color:${t.bg};line-height:${lineHeight};padding:24px 16px;box-sizing:border-box;">`;

  // 识别标题：检查是否有被【】包裹的段落
  let titleIndex = -1;
  let titleContent = '';

  paragraphs.forEach((p, idx) => {
    const match = p.match(/^【(.+)】$/);
    if (match && titleIndex === -1) {
      titleIndex = idx;
      titleContent = match[1]; // 提取方括号内的内容
    }
  });

  const firstPara = titleContent || paragraphs[0] || '';
  let title = firstPara.length <= 28 ? firstPara : (style + '风格排版');

  // 计算图片插入位置
  const imageInsertPositions = [];
  if (imagePaths.length > 0 && paragraphs.length > 2) {
    const interval = Math.floor(paragraphs.length / (imagePaths.length + 1));
    for (let i = 0; i < imagePaths.length; i++) {
      imageInsertPositions.push((i + 1) * interval);
    }
  }

  let imageIndex = 0;

  // 如果识别到标题，先渲染标题
  if (titleIndex !== -1) {
    html += renderTitle(titleContent, t, fontSize, style);
    html += renderDivider(t, style);
  }

  // 处理所有正文段落（跳过标题段落）
  paragraphs.forEach((p, idx) => {
    // 跳过标题段落
    if (idx === titleIndex) return;

    let content = p;

    // 表情装饰（正文段落）
    const actualIdx = titleIndex !== -1 && idx > titleIndex ? idx - 1 : idx;
    if (withEmoji && actualIdx > 0 && actualIdx % 3 === 0) {
      const emojis = ['📌', '💡', '⚠️', '✨', '🎯', '🔑'];
      content = emojis[actualIdx % emojis.length] + ' ' + content;
    }

    // 智能补句号
    const endsWithPunctuation = /[。！？…、，；：""''）】』」》\.]$/.test(content);
    if (!endsWithPunctuation) {
      content += '。';
    }

    // 判断是否为重点句
    const isHighlight = withQuote && (content.length < 60 || /["「『"]/.test(content));

    if (isHighlight) {
      html += renderQuote(content, t, fontSize, style);
    } else {
      html += `<p style="margin:0 0 16px 0;padding:0;text-indent:2em;font-size:${fontSize}px;color:${t.color};line-height:${lineHeight};box-sizing:border-box;">${escapeHtml(content)}</p>`;
    }

    // 插入AI生成的图片
    if (imageInsertPositions.includes(idx) && imageIndex < imagePaths.length) {
      const imgPath = imagePaths[imageIndex];
      html += `<section style="text-align:center;margin:20px 0;padding:0;box-sizing:border-box;"><img src="${imgPath}" alt="AI配图" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" /></section>`;
      imageIndex++;
    }
    // 配图占位符
    else if (withImages && idx === Math.floor(paragraphs.length / 2)) {
      html += `<section style="text-align:center;margin:20px 0;padding:20px;background:linear-gradient(135deg,${t.lightAccent},${t.quoteBg});border-radius:4px;color:${t.accent};font-size:13px;border:1px dashed ${t.quoteBorder};box-sizing:border-box;">🖼️ 配图位 · AI 生图或图库适配</section>`;
    }

    // 段落间分隔符（每4段插入一次）
    if (actualIdx > 0 && actualIdx % 4 === 0 && actualIdx < paragraphs.length - 1) {
      html += renderDivider(t, style);
    }
  });

  html += `</section>`;
  return { html, title };
}

// 渲染标题 - 使用table布局确保公众号兼容性
function renderTitle(content, theme, baseFontSize, styleKey) {
  const titleSize = baseFontSize + 4;
  const escapedContent = escapeHtml(content);

  switch (styleKey) {
    case '简约':
      // 简约：底部细线 + 粗体
      return `<section style="margin:0 0 20px 0;padding:0 0 12px 0;border-bottom:2px solid ${theme.lightAccent};box-sizing:border-box;">
        <h2 style="margin:0;padding:0;font-size:${titleSize}px;font-weight:600;color:${theme.color};line-height:1.4;">${escapedContent}</h2>
      </section>`;

    case '文艺':
      // 文艺：居中 + 上下细线装饰
      return `<section style="text-align:center;margin:0 0 24px 0;padding:16px 0;box-sizing:border-box;">
        <section style="width:60px;height:1px;background:linear-gradient(90deg,transparent,${theme.lightAccent},transparent);margin:0 auto 12px;"></section>
        <h2 style="margin:0;padding:0;font-size:${titleSize}px;font-weight:600;color:${theme.color};line-height:1.4;letter-spacing:1px;">${escapedContent}</h2>
        <section style="width:60px;height:1px;background:linear-gradient(90deg,transparent,${theme.lightAccent},transparent);margin:12px auto 0;"></section>
      </section>`;

    case '商务':
      // 商务：左侧色条
      return `<section style="display:flex;align-items:center;margin:0 0 20px 0;padding:0;box-sizing:border-box;">
        <section style="width:4px;height:${titleSize + 8}px;background:${theme.accent};margin-right:12px;flex-shrink:0;"></section>
        <h2 style="margin:0;padding:0;font-size:${titleSize}px;font-weight:700;color:${theme.color};line-height:1.3;letter-spacing:0.5px;">${escapedContent}</h2>
      </section>`;

    case '清新':
      // 清新：浅色背景块 + 左侧色条
      return `<section style="background:${theme.quoteBg};padding:12px 16px;margin:0 0 20px 0;border-left:4px solid ${theme.accent};border-radius:4px;box-sizing:border-box;">
        <h2 style="margin:0;padding:0;font-size:${titleSize}px;font-weight:600;color:${theme.accent};line-height:1.4;">${escapedContent}</h2>
      </section>`;

    case '经典':
      // 经典：居中 + 底部红色装饰线
      return `<section style="text-align:center;margin:0 0 24px 0;padding:0 0 16px 0;box-sizing:border-box;">
        <h2 style="margin:0 0 8px 0;padding:0;font-size:${titleSize}px;font-weight:700;color:${theme.color};line-height:1.4;letter-spacing:1.5px;">${escapedContent}</h2>
        <section style="width:80px;height:3px;background:${theme.accent};margin:0 auto;"></section>
      </section>`;

    default:
      return `<h2 style="margin:0 0 16px 0;padding:0;font-size:${titleSize}px;font-weight:600;color:${theme.color};line-height:1.4;">${escapedContent}</h2>`;
  }
}

// 渲染引用块 - 使用table或嵌套section确保样式保留
function renderQuote(content, theme, baseFontSize, styleKey) {
  const quoteSize = baseFontSize;
  const escapedContent = escapeHtml(content);

  switch (styleKey) {
    case '简约':
      // 简约：左侧灰色粗线 + 浅灰背景
      return `<section style="margin:16px 0;padding:12px 16px;background:${theme.quoteBg};border-left:3px solid ${theme.quoteBorder};box-sizing:border-box;">
        <p style="margin:0;padding:0;font-size:${quoteSize}px;color:${theme.color};line-height:1.6;">${escapedContent}</p>
      </section>`;

    case '文艺':
      // 文艺：左侧金棕色线 + 米色背景 + 更大圆角
      return `<section style="margin:18px 0;padding:14px 18px;background:${theme.quoteBg};border-left:4px solid ${theme.accent};border-radius:6px;box-sizing:border-box;">
        <p style="margin:0;padding:0;font-size:${quoteSize}px;color:${theme.accent};line-height:1.7;font-style:italic;">${escapedContent}</p>
      </section>`;

    case '商务':
      // 商务：蓝色边框 + 标签
      return `<section style="margin:18px 0;padding:4px 0 0 0;background:${theme.quoteBg};border-left:4px solid ${theme.accent};border-radius:4px;box-sizing:border-box;">
        <section style="padding:0 16px 2px;box-sizing:border-box;">
          <p style="margin:0 0 6px 0;padding:0;font-size:11px;color:${theme.accent};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">KEY POINT</p>
        </section>
        <section style="padding:0 16px 12px;box-sizing:border-box;">
          <p style="margin:0;padding:0;font-size:${quoteSize}px;color:${theme.color};line-height:1.6;font-weight:500;">${escapedContent}</p>
        </section>
      </section>`;

    case '清新':
      // 清新：绿色左侧线 + 浅绿背景 + 大圆角
      return `<section style="margin:18px 0;padding:14px 18px;background:${theme.quoteBg};border-left:3px solid ${theme.accent};border-radius:8px;box-sizing:border-box;">
        <p style="margin:0;padding:0;font-size:${quoteSize}px;color:${theme.accent};line-height:1.7;">${escapedContent}</p>
      </section>`;

    case '经典':
      // 经典：红色左侧线 + 浅红背景 + 衬线字体
      return `<section style="margin:18px 0;padding:14px 18px;background:${theme.quoteBg};border-left:4px solid ${theme.accent};border-radius:4px;box-sizing:border-box;">
        <p style="margin:0;padding:0;font-size:${quoteSize}px;color:${theme.color};line-height:1.8;">${escapedContent}</p>
      </section>`;

    default:
      return `<section style="margin:16px 0;padding:12px 16px;background:${theme.quoteBg};border-left:4px solid ${theme.accent};box-sizing:border-box;">
        <p style="margin:0;padding:0;font-size:${quoteSize}px;color:${theme.accent};line-height:1.6;">${escapedContent}</p>
      </section>`;
  }
}

// 渲染分隔符 - 使用简洁几何图形，避免表情符号
function renderDivider(theme, styleKey) {
  switch (styleKey) {
    case '简约':
      // 简约：单细线
      return `<section style="margin:24px auto;padding:0;width:80%;height:1px;background:${theme.lightAccent};box-sizing:border-box;"></section>`;

    case '文艺':
      // 文艺：渐变细线
      return `<section style="margin:24px auto;padding:0;width:120px;height:1px;background:linear-gradient(90deg,transparent,${theme.lightAccent},transparent);box-sizing:border-box;"></section>`;

    case '商务':
      // 商务：短粗色块
      return `<section style="margin:24px auto;padding:0;width:40px;height:3px;background:${theme.accent};box-sizing:border-box;"></section>`;

    case '清新':
      // 清新：三个小圆点
      return `<section style="text-align:center;margin:24px 0;padding:0;box-sizing:border-box;">
        <span style="display:inline-block;width:5px;height:5px;background:${theme.accent};border-radius:50%;margin:0 4px;opacity:0.3;"></span>
        <span style="display:inline-block;width:5px;height:5px;background:${theme.accent};border-radius:50%;margin:0 4px;opacity:0.6;"></span>
        <span style="display:inline-block;width:5px;height:5px;background:${theme.accent};border-radius:50%;margin:0 4px;opacity:0.3;"></span>
      </section>`;

    case '经典':
      // 经典：双细线
      return `<section style="margin:24px auto;padding:0;width:60%;box-sizing:border-box;">
        <section style="height:1px;background:${theme.accent};margin:0 0 4px 0;opacity:0.6;"></section>
        <section style="height:1px;background:${theme.accent};opacity:0.3;"></section>
      </section>`;

    default:
      return `<section style="margin:20px auto;padding:0;width:60%;height:1px;background:${theme.lightAccent};opacity:0.5;box-sizing:border-box;"></section>`;
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default router;
