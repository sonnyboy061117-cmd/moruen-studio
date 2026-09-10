import { detectSuggestionEnding } from './backend/lib/suggestion-detector.js';

console.log('='.repeat(80));
console.log('建议段检测器测试');
console.log('='.repeat(80));

// 测试案例1：包含隐性建议的结尾（之前生成的实际案例）
const text1 = `拿到offer那天，小语没有想象中那么高兴。

客户只回了两个字：谢谢。没有表情包，没有感叹号，甚至连一句"辛苦了"都没有。

（中间省略...）

其实不光是留学中介，任何服务性质的岗位都躲不开这个陷阱。

这件事让她意识到，在服务行业里，前期建立的信任非常脆弱。一旦出现问题，客户的第一反应往往是质疑你的专业能力，而不是理解客观因素。

信任的建立需要时间，但崩塌只需要一瞬间。在职场上，预防信任危机，比事后修复要容易得多。`;

console.log('\n【测试案例1：包含隐性建议】');
console.log('最后两段：');
console.log('  "这件事让她意识到，在服务行业里..."');
console.log('  "信任的建立需要时间，但崩塌只需要一瞬间。在职场上，预防信任危机，比事后修复要容易得多。"');
console.log('\n检测结果：');
const result1 = detectSuggestionEnding(text1);
console.log('  是否检测到建议段：', result1.hasSuggestion);
console.log('  匹配的模式：', result1.matchedPatterns);
console.log('  检测到的句子：');
result1.detectedSentences.forEach(s => console.log('    -', s));

// 测试案例2：合格的疑问句收尾
const text2 = `拿到offer那天，小语没有想象中那么高兴。

客户只回了两个字：谢谢。

（中间省略...）

小语后来跟同事聊起这件事，感慨说："信任这东西，一旦崩了，后面你做什么都像是在弥补过错，而不是在提供服务。"

这件事让她意识到，在服务行业里，前期建立的信任非常脆弱。一旦出现问题，客户的第一反应往往是质疑你的专业能力，而不是理解客观因素。

当信任已经出现裂缝的时候，你觉得还能回到从前吗？`;

console.log('\n\n【测试案例2：疑问句收尾（合格）】');
console.log('最后一句：');
console.log('  "当信任已经出现裂缝的时候，你觉得还能回到从前吗？"');
console.log('\n检测结果：');
const result2 = detectSuggestionEnding(text2);
console.log('  是否检测到建议段：', result2.hasSuggestion);
console.log('  匹配的模式：', result2.matchedPatterns);
console.log('  检测到的句子：');
result2.detectedSentences.forEach(s => console.log('    -', s));

// 测试案例3：包含明显建议的结尾
const text3 = `前面的故事内容...

对于新人来说，这种情况其实挺常见的。遇到这种情况，最好的办法是：

第一时间坦诚沟通，不要试图掩饰问题。给出具体的解决方案和时间表，而不是空泛的承诺。

定期主动汇报进度，不要等客户来问。即使客户态度冷淡，也要保持专业和耐心。`;

console.log('\n\n【测试案例3：明显建议段（最好/不要）】');
console.log('最后部分：');
console.log('  "最好的办法是：第一时间坦诚沟通，不要试图掩饰问题..."');
console.log('\n检测结果：');
const result3 = detectSuggestionEnding(text3);
console.log('  是否检测到建议段：', result3.hasSuggestion);
console.log('  匹配的模式：', result3.matchedPatterns);
console.log('  检测到的句子：');
result3.detectedSentences.forEach(s => console.log('    -', s));

// 测试案例4：包含具体情节的句子（应该被排除）
const text4 = `故事内容...

接下来的30天里，小语天天跟进，补材料、催进度、跟校方沟通，最后申请通过了，客户也顺利拿到了offer。

小语第一时间联系客户说明情况，解释这是移民局政策调整导致的，并且承诺会尽快处理。`;

console.log('\n\n【测试案例4：包含"需要/应该"但在复述具体情节（应排除）】');
console.log('最后部分：');
console.log('  "...并且承诺会尽快处理"（包含"需要"但是复述情节）');
console.log('\n检测结果：');
const result4 = detectSuggestionEnding(text4);
console.log('  是否检测到建议段：', result4.hasSuggestion);
console.log('  匹配的模式：', result4.matchedPatterns);
console.log('  检测到的句子：');
result4.detectedSentences.forEach(s => console.log('    -', s));

console.log('\n' + '='.repeat(80));
console.log('测试完成');
console.log('='.repeat(80));
