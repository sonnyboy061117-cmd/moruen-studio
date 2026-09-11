import puppeteer from 'puppeteer';
import { fetchArticle } from './backend/lib/readability.js';

// 测试用的公众号文章链接（包含不同类型）
const testUrls = [
  'https://mp.weixin.qq.com/s/vNf6yQD0VZmk9RUzDZmrqw',
  'https://mp.weixin.qq.com/s/WDUYJvn-oACfyFP0KPcDag',
  'https://mp.weixin.qq.com/s/2WKS1cgzHDcMfA3lvC-vlQ',
  'https://mp.weixin.qq.com/s/6N5LeGgBNTv9GP0YVNGnKQ',
  'https://mp.weixin.qq.com/s/uCzOLDuS2jsfBX9VnB_lEg?click_id=1504256635',
  'https://mp.weixin.qq.com/s/n1mKHUEIRDu7V-WG-wpM2Q',
  'https://mp.weixin.qq.com/s/2zDfkZma9jVnzWohEzwjAA',
  'https://mp.weixin.qq.com/s/hWjXYAbN9X3_5to2Es4mJg',
  'https://mp.weixin.qq.com/s/EgpnupAvH_gyZLBWSNbCoQ',
  'https://mp.weixin.qq.com/s/pQMhK3qWNoD8nOxWyGD0kQ',
  'https://mp.weixin.qq.com/s/mAZY9oztxotG9vm7aa97tA',
  'https://mp.weixin.qq.com/s/GCj8eYpz2s4KEi44B6doDQ',
  'https://mp.weixin.qq.com/s/s_yczGZSxA7BY-guGDnNqQ'
];

// 使用Puppeteer抓取文章
async function fetchWithPuppeteer(url) {
  const startTime = Date.now();
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 设置超时和用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待内容加载
    await page.waitForSelector('#js_content, .rich_media_content', { timeout: 10000 });

    // 提取标题和正文
    const data = await page.evaluate(() => {
      const titleEl = document.querySelector('#activity-name, .rich_media_title, h1');
      const contentEl = document.querySelector('#js_content, .rich_media_content');

      return {
        title: titleEl ? titleEl.innerText.trim() : '',
        content: contentEl ? contentEl.innerText.trim() : ''
      };
    });

    const endTime = Date.now();
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

    await browser.close();

    return {
      success: true,
      title: data.title,
      contentLength: data.content.length,
      time: endTime - startTime,
      memory: memAfter - memBefore
    };

  } catch (error) {
    if (browser) await browser.close();

    const endTime = Date.now();
    return {
      success: false,
      error: error.message,
      time: endTime - startTime
    };
  }
}

// 使用现有Cheerio方案抓取
async function fetchWithCheerio(url) {
  const startTime = Date.now();

  try {
    const result = await fetchArticle(url);
    const endTime = Date.now();

    return {
      success: result.ok,
      title: result.title || '',
      contentLength: result.text?.length || 0,
      time: endTime - startTime,
      error: result.ok ? null : result.message
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      success: false,
      error: error.message,
      time: endTime - startTime
    };
  }
}

// 运行对比测试
async function runComparison() {
  console.log('='.repeat(80));
  console.log('Puppeteer vs Cheerio 抓取对比测试');
  console.log('='.repeat(80));
  console.log('\n测试URL数量:', testUrls.length);
  console.log('\n开始测试...\n');

  const results = [];

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`\n[${i + 1}/${testUrls.length}] 测试: ${url}`);

    // Cheerio方案
    console.log('  → Cheerio 抓取中...');
    const cheerioResult = await fetchWithCheerio(url);
    console.log(`    ${cheerioResult.success ? '✓' : '✗'} ${cheerioResult.success ? '成功' : '失败'} | 耗时: ${cheerioResult.time}ms | 内容长度: ${cheerioResult.contentLength}字`);
    if (!cheerioResult.success) {
      console.log(`    错误: ${cheerioResult.error}`);
    }

    // Puppeteer方案
    console.log('  → Puppeteer 抓取中...');
    const puppeteerResult = await fetchWithPuppeteer(url);
    console.log(`    ${puppeteerResult.success ? '✓' : '✗'} ${puppeteerResult.success ? '成功' : '失败'} | 耗时: ${puppeteerResult.time}ms | 内容长度: ${puppeteerResult.contentLength}字 | 内存: ${puppeteerResult.memory?.toFixed(2)}MB`);
    if (!puppeteerResult.success) {
      console.log(`    错误: ${puppeteerResult.error}`);
    }

    results.push({
      url,
      cheerio: cheerioResult,
      puppeteer: puppeteerResult
    });
  }

  // 统计汇总
  console.log('\n' + '='.repeat(80));
  console.log('测试结果汇总');
  console.log('='.repeat(80));

  const cheerioSuccess = results.filter(r => r.cheerio.success).length;
  const puppeteerSuccess = results.filter(r => r.puppeteer.success).length;

  const cheerioAvgTime = results.reduce((sum, r) => sum + r.cheerio.time, 0) / results.length;
  const puppeteerAvgTime = results.reduce((sum, r) => sum + r.puppeteer.time, 0) / results.length;

  const puppeteerAvgMemory = results
    .filter(r => r.puppeteer.memory)
    .reduce((sum, r) => sum + r.puppeteer.memory, 0) / puppeteerSuccess || 0;

  console.log('\n【成功率对比】');
  console.log(`  Cheerio:    ${cheerioSuccess}/${testUrls.length} (${(cheerioSuccess/testUrls.length*100).toFixed(1)}%)`);
  console.log(`  Puppeteer:  ${puppeteerSuccess}/${testUrls.length} (${(puppeteerSuccess/testUrls.length*100).toFixed(1)}%)`);

  console.log('\n【平均耗时对比】');
  console.log(`  Cheerio:    ${cheerioAvgTime.toFixed(0)}ms`);
  console.log(`  Puppeteer:  ${puppeteerAvgTime.toFixed(0)}ms (慢 ${((puppeteerAvgTime/cheerioAvgTime - 1) * 100).toFixed(1)}%)`);

  console.log('\n【Puppeteer平均内存占用】');
  console.log(`  ${puppeteerAvgMemory.toFixed(2)}MB per request`);

  console.log('\n【失败案例分析】');
  const cheerioFailed = results.filter(r => !r.cheerio.success);
  const puppeteerFailed = results.filter(r => !r.puppeteer.success);

  if (cheerioFailed.length > 0) {
    console.log(`  Cheerio 失败 ${cheerioFailed.length} 个:`);
    cheerioFailed.forEach(r => {
      console.log(`    - ${r.url}`);
      console.log(`      原因: ${r.cheerio.error}`);
    });
  }

  if (puppeteerFailed.length > 0) {
    console.log(`  Puppeteer 失败 ${puppeteerFailed.length} 个:`);
    puppeteerFailed.forEach(r => {
      console.log(`    - ${r.url}`);
      console.log(`      原因: ${r.puppeteer.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('测试完成');
  console.log('='.repeat(80));
}

runComparison().catch(console.error);
