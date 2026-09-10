import { buildBatchRewritePrompt } from './backend/lib/prompts.js';
import { readFileSync, existsSync } from 'fs';

// 读取 backend/.env 文件
const envPath = './backend/.env';
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const API_KEY = process.env.RELAY_API_KEY;

// 测试文章
const testArticle = `信任崩了之后，道歉和解释都没用了

小语在一家留学中介做顾问，帮学生申请海外院校。去年接了一个客户，目标是澳洲的几所大学。

前期沟通挺顺利，文书也改了好几轮，双方都觉得没问题。结果递交材料后，移民局那边因为某个细节问题把申请打回来了，需要重新补充材料。

小语第一时间联系客户说明情况，解释这是移民局政策调整导致的，并且承诺会尽快处理。但客户那边已经开始怀疑，觉得是不是文书有问题，是不是中介不专业。

接下来的30天里，小语天天跟进，补材料、催进度、跟校方沟通，最后申请通过了，客户也顺利拿到了offer。

但整个过程中，客户的态度一直很冷淡，每次沟通都带着质疑的语气。即使最后结果是好的，客户也没有表现出太多的感激，只是简单说了句"谢谢"。

小语后来跟同事聊起这件事，感慨说："信任这东西，一旦崩了，后面你做什么都像是在弥补过错，而不是在提供服务。"

这件事让她意识到，在服务行业里，前期建立的信任非常脆弱。一旦出现问题，客户的第一反应往往是质疑你的专业能力，而不是理解客观因素。

对于新人来说，这种情况其实挺常见的。遇到这种情况，最好的办法是：

1. 第一时间坦诚沟通，不要试图掩饰问题
2. 给出具体的解决方案和时间表，而不是空泛的承诺
3. 定期主动汇报进度，不要等客户来问
4. 即使客户态度冷淡，也要保持专业和耐心

信任的建立需要时间，但崩塌只需要一瞬间。在职场上，预防信任危机，比事后修复要容易得多。`;

async function callAPI(messages, temperature = 0.7) {
  const response = await fetch('http://115.159.203.67:3000/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function testRegenerationComparison() {
  console.log('='.repeat(80));
  console.log('测试：对比首次生成 vs 重新生成');
  console.log('='.repeat(80));

  // 测试版本2（倒叙型）
  const versionIndex = 1;
  const usedOpenings = ['信任塌了，后'];  // 模拟其他版本已用的开篇

  console.log(`\n测试版本索引：${versionIndex}`);
  console.log('对应的版本策略：版本2 - 倒叙突出结果型');

  // 生成Prompt
  const prompt = buildBatchRewritePrompt({
    originalText: testArticle,
    strength: '深度改写',
    logic: ['换角度重写'],
    targetLength: '800-1000字',
    angle: '职场信任危机',
    versionIndex,
    usedOpenings
  });

  // 打印版本策略
  console.log('\n【版本策略详情】');
  const lines = prompt.split('\n');
  const strategyStart = lines.findIndex(line => line.includes('⚠️ 版本'));
  if (strategyStart >= 0) {
    for (let i = strategyStart; i < Math.min(strategyStart + 10, lines.length); i++) {
      if (lines[i].trim()) console.log(lines[i]);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('【第1次生成】');
  console.log('='.repeat(80));

  try {
    const result1 = await callAPI([{ role: 'user', content: prompt }], 0.85);
    console.log(result1);
    console.log('\n【第1次生成 - 结构分析】');
    analyzeStructure(result1);

    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n\n' + '='.repeat(80));
    console.log('【第2次生成（模拟重新生成）】');
    console.log('='.repeat(80));

    const result2 = await callAPI([{ role: 'user', content: prompt }], 0.85);
    console.log(result2);
    console.log('\n【第2次生成 - 结构分析】');
    analyzeStructure(result2);

    console.log('\n\n' + '='.repeat(80));
    console.log('【对比分析】');
    console.log('='.repeat(80));
    compareResults(result1, result2);

  } catch (error) {
    console.error('生成失败:', error.message);
  }
}

function analyzeStructure(text) {
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  console.log(`- 段落数：${paragraphs.length}`);
  console.log(`- 开篇前30字：${text.substring(0, 30)}...`);
  console.log(`- 结尾最后50字：...${text.substring(text.length - 50)}`);

  // 检查是否有建议段
  const hasSuggestions = /第一|其次|最后|建议|应该|最好/.test(text);
  console.log(`- 是否包含建议段：${hasSuggestions ? '是' : '否'}`);
}

function compareResults(text1, text2) {
  const p1 = text1.split('\n\n').filter(p => p.trim());
  const p2 = text2.split('\n\n').filter(p => p.trim());

  console.log(`段落数对比：第1次 ${p1.length} 段 vs 第2次 ${p2.length} 段`);

  const opening1 = text1.substring(0, 50);
  const opening2 = text2.substring(0, 50);
  console.log(`\n开篇对比：`);
  console.log(`  第1次：${opening1}...`);
  console.log(`  第2次：${opening2}...`);

  // 简单的相似度估算（基于字符重复率）
  const commonChars = new Set([...text1].filter(c => text2.includes(c)));
  const similarity = (commonChars.size / Math.max(text1.length, text2.length) * 100).toFixed(1);
  console.log(`\n粗略相似度估算：${similarity}%`);

  console.log('\n结论：两次生成是否有结构性差异？');
  if (p1.length === p2.length && opening1.substring(0, 10) === opening2.substring(0, 10)) {
    console.log('  ⚠️  疑似结构雷同：段落数相同且开篇相似');
  } else {
    console.log('  ✓ 有明显差异');
  }
}

testRegenerationComparison().catch(console.error);
