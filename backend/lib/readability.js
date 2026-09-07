// 墨韵工坊 · 后端链接抓取
// 用 cheerio 解析,支持公众号/头条/知乎特定选择器
// 增强版：优化公众号抓取，失败时引导手动粘贴
import * as cheerio from 'cheerio';

const UA_LIST = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
];

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
      // 移除不需要的元素
      el.find('script, style, nav, header, footer, aside, .advertisement, .ad').remove();

      // 提取HTML内容（保留图片等标签）
      const html = el.html();
      const text = el.text().trim();

      // 检查文本长度，但返回HTML
      if (text.length > 100) return html;
    }
  }
  return '';
}

function htmlToText(html) {
  const $ = cheerio.load(html);
  // 移除 script/style/nav
  $('script, style, nav, header, footer, aside, .advertisement, .ad').remove();
  // 返回HTML内容而非纯文本，保留图片标签
  return $('body').html() || '';
}

async function tryFetchWithUA(url, ua, timeout = 15000) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://mp.weixin.qq.com/'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout)
    });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    return null;
  }
}

export async function fetchArticle(url) {
  // 公众号文章也尝试抓取，不再直接返回失败
  const isWechat = isWechatMp(url);

  // 尝试多个 User-Agent
  let html = null;
  for (let i = 0; i < UA_LIST.length; i++) {
    html = await tryFetchWithUA(url, UA_LIST[i], isWechat ? 12000 : 15000);
    if (html) break;
  }

  if (!html) {
    return {
      ok: false,
      needManualInput: true,
      url,
      title: '',
      text: '',
      message: isWechat
        ? '公众号文章自动抓取失败（反爬保护），请点击「手动粘贴」按钮'
        : '网络请求失败，请检查链接或手动粘贴全文'
    };
  }

  try {
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content')
      || $('title').text()
      || $('h1').first().text()
      || '';

    let text = '';
    if (isWechat) text = extractBySelectors($, SELECTORS.wechat);
    else if (isZhihu(url)) text = extractBySelectors($, SELECTORS.zhihu);
    else if (isToutiao(url)) text = extractBySelectors($, SELECTORS.toutiao);
    if (!text) text = extractBySelectors($, SELECTORS.generic);
    if (!text) text = htmlToText(html);

    if (text.length < 80) {
      return {
        ok: false,
        needManualInput: true,
        url,
        title,
        text,
        message: `抓取内容过短(${text.length}字)，可能需要登录或为动态页面，请手动粘贴全文`
      };
    }

    return { ok: true, url, title: title.trim(), text, isWechat };
  } catch (e) {
    return {
      ok: false,
      needManualInput: true,
      url,
      title: '',
      text: '',
      message: '内容解析失败，请手动粘贴全文'
    };
  }
}
