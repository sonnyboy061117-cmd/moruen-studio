import { buildUniversalPrompt } from './lib/prompts.js';

const testText = `我认识的小语就做到了这一点。她的留学业务主要靠一个资源方介绍客户，合作一直很顺利，直到那次签证事件彻底搞砸了。

事情的起因其实挺常见：一个学生的签证递交了好几个月都没消息，家长急了，周末晚上八九点开始轰炸资源方。偏偏资源方那天发着高烧，扛着巨大的压力想找小语团队商量对策，结果消息发出去石沉大海——小语直到晚上10点多才看到，那会儿资源方已经把电话拉黑了。

但小语选择了一条最笨也最管用的路：每天给移民局打电话，打了整整一个月。30天，没有一天间断。`;

console.log('========== 中度改写 Prompt ==========');
const mediumPrompt = buildUniversalPrompt({
  text: testText,
  strength: '中度',
  style: '真实案例风格'
});

// 查找人名保护规则
const hasNameRule = mediumPrompt.includes('**人名**：原样保留');
const factRulesSection = mediumPrompt.match(/【事实信息锁定规则[\s\S]*?】\n\n/);

console.log('\n✓ 是否包含人名保护规则:', hasNameRule);
console.log('\n✓ 事实锁定规则片段:');
if (factRulesSection) {
  console.log(factRulesSection[0].substring(0, 500));
}

console.log('\n✓ Prompt总长度:', mediumPrompt.length, '字符');
console.log('\n========== 完整Prompt ==========');
console.log(mediumPrompt);
