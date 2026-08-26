// 墨韵工坊 · 后端链接抓取
// 用 cheerio 解析,支持公众号/头条/知乎特定选择器
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function isWechatMp(url) { return /mp\.weixin\.qq\.com/.test(url); }
function isZhihu(url) { return /(zhihu|zhuanlan)\.com/.test(url); }
function isToutiao(url) { return /toutiao\.com/.test(url); }

// 平台特定选择器
const SELECTORS = {
  wechat: ['#js_content', '.rich_media_content', '#content'],
  zhihu: ['.RichText', '.Post-RichText', '.ContentItem-content'],
  toutiao: ['article', '.article-content', '.tt-article-content'],
  generic: ['article', 'main', '.content', '.post-content', '.article', '#content', '#main']
};

function extractBySelectors($, selectors) {
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      const text = el.text().trim();
      if (text.length > 100) return text;
    }
  }
  return '';
}

function htmlToText(html) {
  const $ = cheerio.load(html);
  // 移除 script/style/nav
  $('script, style, nav, header, footer, aside, .advertisement, .ad').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

export async function fetchArticle(url) {
  if (isWechatMp(url)) {
    return {
      ok: false,
      isWechat: true,
      url,
      title: '',
      text: '',
      message: '公众号文章通常需要登录态 cookie,服务端抓取也常被反爬拦截。建议复制原文到「万能改写」使用。'
    };
  }

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) {
      return { ok: false, url, title: '', text: '', message: `HTTP ${r.status}` };
    }
    const html = await r.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content')
      || $('title').text()
      || $('h1').first().text()
      || '';

    let text = '';
    if (isZhihu(url)) text = extractBySelectors($, SELECTORS.zhihu);
    else if (isToutiao(url)) text = extractBySelectors($, SELECTORS.toutiao);
    if (!text) text = extractBySelectors($, SELECTORS.generic);
    if (!text) text = htmlToText(html);

    if (text.length < 80) {
      return { ok: false, url, title, text, message: `抓取内容过短(${text.length}字),可能是 SPA 页面` };
    }

    return { ok: true, url, title: title.trim(), text };
  } catch (e) {
    return { ok: false, url, title: '', text: '', message: '抓取失败: ' + e.message };
  }
}
