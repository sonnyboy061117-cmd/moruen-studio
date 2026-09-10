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
if (!API_KEY) {
  console.error('错误：请在 backend/.env 中设置 RELAY_API_KEY');
  process.exit(1);
}

// 测试文章：小语做留学中介的故事
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

async function callDeepseek(messages, temperature = 0.7) {
  // 使用项目的中转服务
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

async function testBatchRewrite() {
  console.log('='.repeat(80));
  console.log('批量改写三版本策略测试');
  console.log('='.repeat(80));
  console.log('\n原文：');
  console.log(testArticle);
  console.log('\n' + '='.repeat(80));

  const usedOpenings = [];

  for (let versionIndex = 0; versionIndex < 3; versionIndex++) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`版本 ${versionIndex + 1} 生成中...`);
    console.log('='.repeat(80));

    const prompt = buildBatchRewritePrompt({
      originalText: testArticle,
      strength: '深度改写',
      logic: ['换角度重写'],
      targetLength: '800-1000字',
      angle: '职场信任危机',
      versionIndex,
      usedOpenings
    });

    console.log('\n【使用的Prompt片段】');
    const lines = prompt.split('\n');
    const strategyStart = lines.findIndex(line => line.includes('⚠️ 版本'));
    if (strategyStart >= 0) {
      console.log(lines.slice(strategyStart, strategyStart + 6).join('\n'));
    }

    try {
      const result = await callDeepseek([
        { role: 'user', content: prompt }
      ], 0.85);

      // 提取开篇前6字
      const cleanText = result.replace(/^【.*?】\s*/, '');
      const opening = cleanText.substring(0, 6);
      usedOpenings.push(opening);

      console.log('\n【生成结果】');
      console.log(result);
      console.log('\n【开篇前6字】', opening);
      console.log('【已使用开篇词】', usedOpenings);

    } catch (error) {
      console.error(`版本 ${versionIndex + 1} 生成失败:`, error.message);
    }

    // 延迟避免API限流
    if (versionIndex < 2) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('测试完成');
  console.log('='.repeat(80));
}

testBatchRewrite().catch(console.error);
