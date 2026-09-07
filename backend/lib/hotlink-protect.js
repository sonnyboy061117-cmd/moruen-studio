// 墨韵工坊 · 图片防盗链处理
// 下载微信公众号图片(mmbiz.qpic.cn)到本地，避免防盗链失效
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = path.join(__dirname, '..', 'public', 'cached-images');

// 确保图片目录存在
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

/**
 * 检测并处理文章中的防盗链图片
 * @param {string} text - 文章内容（可能包含图片URL）
 * @returns {Promise<string>} 替换后的内容
 */
export async function processHotlinkImages(text) {
  // 匹配微信图片链接（常见格式）
  const wechatImageRegex = /https?:\/\/[^'")\s]*mmbiz\.qpic\.cn[^'")\s]*/gi;
  const matches = text.match(wechatImageRegex);

  if (!matches || matches.length === 0) {
    return text; // 没有防盗链图片，直接返回
  }

  let result = text;
  const processed = new Set(); // 避免重复处理相同URL

  for (const url of matches) {
    if (processed.has(url)) continue;
    processed.add(url);

    try {
      const localPath = await downloadWechatImage(url);
      if (localPath) {
        // 全局替换该URL
        result = result.replace(new RegExp(escapeRegex(url), 'g'), localPath);
      }
    } catch (err) {
      console.warn(`图片下载失败: ${url}`, err.message);
      // 下载失败不影响其他图片和整体流程
    }
  }

  return result;
}

/**
 * 下载微信图片到本地
 * @param {string} imageUrl - 微信图片URL
 * @returns {Promise<string>} 本地访问路径
 */
async function downloadWechatImage(imageUrl) {
  try {
    // 设置合适的headers绕过防盗链检测
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000) // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 检查文件大小（避免下载异常大的文件）
    if (buffer.length > 10 * 1024 * 1024) { // 10MB限制
      throw new Error('图片文件过大');
    }

    // 生成唯一文件名
    const hash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 16);
    const ext = detectImageExtension(buffer);
    const filename = `wx-${Date.now()}-${hash}.${ext}`;
    const filepath = path.join(IMAGE_DIR, filename);

    fs.writeFileSync(filepath, buffer);

    // 返回可访问的相对路径
    return `/cached-images/${filename}`;
  } catch (error) {
    throw new Error(`下载失败: ${error.message}`);
  }
}

/**
 * 根据文件头检测图片格式
 */
function detectImageExtension(buffer) {
  const header = buffer.toString('hex', 0, 4).toUpperCase();

  if (header.startsWith('FFD8FF')) return 'jpg';
  if (header.startsWith('89504E47')) return 'png';
  if (header.startsWith('47494638')) return 'gif';
  if (header.startsWith('52494646')) return 'webp';

  return 'jpg'; // 默认
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 清理过期缓存图片（可选，定期执行）
 * @param {number} maxAgeDays - 保留天数，超过此时间的文件将被删除
 */
export function cleanupOldImages(maxAgeDays = 7) {
  try {
    const files = fs.readdirSync(IMAGE_DIR);
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    for (const file of files) {
      const filepath = path.join(IMAGE_DIR, file);
      const stat = fs.statSync(filepath);

      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    }

    console.log(`[图片缓存清理] 删除 ${deletedCount} 个过期文件`);
  } catch (error) {
    console.error('[图片缓存清理失败]', error.message);
  }
}
