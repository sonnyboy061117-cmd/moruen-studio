/**
 * 测试编造检测器的实际检测能力
 */

import { detectPrecisionFabrication, formatViolationReport } from './backend/lib/fabrication-detector.js';

// 测试用例1：您提到的实际违规案例
const testCase1 = {
  original: `某天晚上10点多，孩子发着高烧，我一直守在床边。`,
  rewritten: `去年11月的一天晚上10点多，孩子烧到39度2，我一直守在床边。她跟我说，当时盯着手机屏幕，真想直接关机。`,
  description: '时间精确化(去年11月) + 体温精确化(39度2) + 虚构对话'
};

// 测试用例2：数字对比法基础测试
const testCase2 = {
  original: `他在晚上到达，发着高烧，等了好几个月。`,
  rewritten: `他在晚上10点40到达，烧到38度9，等了大概三个月。`,
  description: '时间精确化(10点40) + 体温精确化(38度9) + 时长精确化(三个月)'
};

// 测试用例3：无违规正常改写
const testCase3 = {
  original: `孩子在晚上10点45分回家，体温39.2度，等了三个月。`,
  rewritten: `孩子在晚上10点45分到家，发烧39.2度，等待了三个月时间。`,
  description: '无违规：所有数字都在原文中存在'
};

async function runTest(testCase, index) {
  console.log(`\n========== 测试用例 ${index} ==========`);
  console.log(`描述: ${testCase.description}`);
  console.log(`原文: ${testCase.original}`);
  console.log(`改写稿: ${testCase.rewritten}`);
  console.log(`\n检测中...`);

  try {
    const result = await detectPrecisionFabrication(testCase.original, testCase.rewritten, {
      provider: 'deepseek',
      demo: false // 改为false以测试真实检测（但虚构检测部分会跳过，因为需要API）
    });

    console.log(`\n✅ 检测完成:`);
    console.log(`  hasFabrication: ${result.hasFabrication}`);
    console.log(`  违规数量: ${result.violations.length}`);

    if (result.violations.length > 0) {
      console.log(`\n违规详情:`);
      result.violations.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.type}`);
        console.log(`     内容: ${JSON.stringify(v.pattern)}`);
        console.log(`     说明: ${v.message}`);
      });

      console.log(`\n格式化报告:\n${formatViolationReport(result.violations)}`);
    } else {
      console.log(`  ✓ 未检测到违规`);
    }
  } catch (error) {
    console.error(`❌ 检测失败:`, error.message);
    console.error(error.stack);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('编造检测器测试');
  console.log('='.repeat(60));

  // 先测试数字提取功能
  console.log('\n【预检】测试数字提取功能...');
  const { extractNumberExpressions } = await import('./backend/lib/fabrication-detector.js');

  // 注意：extractNumberExpressions 不是导出的，我们需要修改检测器文件导出它
  // 暂时跳过这个预检

  await runTest(testCase1, 1);
  await runTest(testCase2, 2);
  await runTest(testCase3, 3);

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

main().catch(console.error);
