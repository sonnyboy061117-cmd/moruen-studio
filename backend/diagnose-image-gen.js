// AI自动配图功能诊断脚本
import { getKey, isConfigured } from './lib/keys.js';
import { config } from './lib/config.js';

console.log('========== AI自动配图功能诊断 ==========\n');

// 1. 检查通义万相配置
console.log('1. 检查通义万相供应商配置:');
const tongyiConfig = config.providers.providers['tongyi-wanxiang'];
if (tongyiConfig) {
  console.log('  ✓ 供应商配置存在');
  console.log('  - 名称:', tongyiConfig.name);
  console.log('  - 类型:', tongyiConfig.type);
  console.log('  - 模型:', tongyiConfig.models);
} else {
  console.log('  ✗ 供应商配置不存在');
}

// 2. 检查密钥是否已配置
console.log('\n2. 检查通义万相密钥:');
const configured = isConfigured('tongyi-wanxiang');
console.log('  配置状态:', configured ? '✓ 已配置' : '✗ 未配置');
if (configured) {
  const key = getKey('tongyi-wanxiang');
  if (key) {
    console.log('  密钥长度:', key.length);
    console.log('  密钥前缀:', key.substring(0, 7) + '...');
  } else {
    console.log('  ✗ 密钥读取失败');
  }
}

// 3. 检查image-gen.js模块
console.log('\n3. 检查image-gen.js模块:');
try {
  const imageGen = await import('./lib/image-gen.js');
  console.log('  ✓ 模块加载成功');
  console.log('  - generateArticleImages函数:', typeof imageGen.generateArticleImages);
} catch (e) {
  console.log('  ✗ 模块加载失败:', e.message);
}

// 4. 检查public目录
console.log('\n4. 检查图片存储目录:');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const imageDir = path.join(publicDir, 'generated-images');
console.log('  public目录:', fs.existsSync(publicDir) ? '✓ 存在' : '✗ 不存在');
console.log('  generated-images目录:', fs.existsSync(imageDir) ? '✓ 存在' : '✗ 不存在');

// 5. 测试fetch可用性
console.log('\n5. 检查fetch函数:');
console.log('  fetch可用:', typeof fetch === 'function' ? '✓ 是' : '✗ 否');

console.log('\n========== 诊断完成 ==========');
