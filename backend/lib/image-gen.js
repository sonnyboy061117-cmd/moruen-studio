// 图片生成模块
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = path.join(__dirname, '..', 'public', 'generated-images');

// 确保图片目录存在
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

/**
 * 生成文章配图
 * @param {string} articleContent - 文章正文
 * @param {object} llmClient - LLM客户端（用于分析文章生成场景描述）
 * @param {string} imageApiKey - 通义万相API Key
 * @returns {Promise<string[]>} 本地图片路径数组
 */
export async function generateArticleImages(articleContent, llmClient, imageApiKey) {
  try {
    // 步骤1: 使用LLM分析文章，生成2-4个配图场景描述
    const scenes = await extractImageScenes(articleContent, llmClient);

    if (!scenes || scenes.length === 0) {
      throw new Error('未能从文章中提取配图场景');
    }

    // 步骤2: 为每个场景调用通义万相生成图片
    const imageUrls = [];
    for (const scene of scenes) {
      try {
        const imageUrl = await generateImageFromScene(scene, imageApiKey);
        if (imageUrl) {
          imageUrls.push(imageUrl);
        }
      } catch (err) {
        console.warn(`场景"${scene}"生成图片失败:`, err.message);
        // 单个场景失败不影响整体流程
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('所有场景的图片生成均失败');
    }

    // 步骤3: 下载图片并保存到本地
    const localPaths = [];
    for (const url of imageUrls) {
      try {
        const localPath = await downloadAndSaveImage(url);
        localPaths.push(localPath);
      } catch (err) {
        console.warn(`图片下载失败: ${url}`, err.message);
      }
    }

    return localPaths;
  } catch (error) {
    throw new Error(`图片生成失败: ${error.message}`);
  }
}

/**
 * 使用LLM从文章中提取2-4个配图场景描述
 */
async function extractImageScenes(articleContent, llmClient) {
  const prompt = `请分析以下文章内容，提取2-4个适合配图的场景。每个场景用一句简洁的中文描述（15-30字），要具体、有画面感，适合AI绘画生成。

文章内容：
${articleContent.substring(0, 2000)}

要求：
1. 返回纯JSON数组格式，如：["场景描述1", "场景描述2", "场景描述3"]
2. 每个描述要具体，包含人物/物品/环境等元素
3. 避免抽象概念，要有具体画面
4. 适合16:9或4:3的横版配图

直接返回JSON数组，不要其他解释：`;

  try {
    const response = await llmClient.chat([
      { role: 'user', content: prompt }
    ]);

    const content = response.trim();
    // 尝试解析JSON
    let scenes = JSON.parse(content);

    if (!Array.isArray(scenes)) {
      throw new Error('返回格式不是数组');
    }

    // 限制2-4个场景
    scenes = scenes.slice(0, 4);
    if (scenes.length < 2) {
      throw new Error('场景数量不足');
    }

    return scenes;
  } catch (error) {
    throw new Error(`场景提取失败: ${error.message}`);
  }
}

/**
 * 调用通义万相API生成图片
 */
async function generateImageFromScene(sceneDescription, apiKey) {
  const API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify({
        model: 'wanx-v1',
        input: {
          prompt: sceneDescription
        },
        parameters: {
          style: '<auto>',
          size: '1024*1024',
          n: 1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    // 通义万相是异步API，需要轮询任务状态
    if (result.output && result.output.task_id) {
      return await pollTaskStatus(result.output.task_id, apiKey);
    } else if (result.output && result.output.results && result.output.results[0]) {
      return result.output.results[0].url;
    } else {
      throw new Error('API返回格式异常');
    }
  } catch (error) {
    throw new Error(`通义万相API调用失败: ${error.message}`);
  }
}

/**
 * 轮询通义万相任务状态
 */
async function pollTaskStatus(taskId, apiKey, maxAttempts = 30) {
  const TASK_URL = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000); // 等待2秒

    try {
      const response = await fetch(TASK_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`任务查询失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.output && result.output.task_status === 'SUCCEEDED') {
        if (result.output.results && result.output.results[0]) {
          return result.output.results[0].url;
        }
      } else if (result.output && result.output.task_status === 'FAILED') {
        throw new Error('图片生成任务失败');
      }
      // PENDING 或 RUNNING 状态继续等待
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw error;
      }
    }
  }

  throw new Error('图片生成超时');
}

/**
 * 下载图片并保存到本地
 */
async function downloadAndSaveImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }

    // Node.js 内置 fetch 使用 arrayBuffer()
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成唯一文件名
    const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
    const filename = `${Date.now()}-${hash}.jpg`;
    const filepath = path.join(IMAGE_DIR, filename);

    fs.writeFileSync(filepath, buffer);

    // 返回可访问的相对路径
    return `/generated-images/${filename}`;
  } catch (error) {
    throw new Error(`图片保存失败: ${error.message}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
