// 完整测试AI自动配图流程
import { getKey } from './lib/keys.js';
import { chat } from './lib/llm.js';

const imageKey = getKey('tongyi-wanxiang');
const textProvider = 'deepseek'; // 或者你的默认文本模型

if (!imageKey) {
  console.error('❌ 未配置通义万相API密钥');
  process.exit(1);
}

console.log('开始测试完整的AI自动配图流程...\n');

const testArticle = `说来也怪，让我在老家县城拿下那套小房子的，不是什么高深财技，而是个土得掉渣的招数——每月工资一到账，我就当它完全没少了一块。这种"自欺欺人"的法子，我硬是玩了五年。

2019年那会儿，我蜗居在杭州城西某苑一区，三十来平的二手房，月租两千五，工资到手八千。每月十五号，我雷打不动地转四千块，进一张连手机银行都没绑的储蓄卡里。那张卡我现货去柜台存号，可正是这份伪陋烦，让我断了随时花钱的念想。`;

// 步骤1: 使用LLM分析文章生成配图场景
console.log('步骤1: 使用LLM分析文章，提取配图场景...');

const llmClient = {
  chat: async (messages) => {
    return await chat({
      provider: textProvider,
      messages: messages,
      temperature: 0.7,
      maxTokens: 1024
    });
  }
};

const prompt = `请分析以下文章内容，提取2-4个适合配图的场景。每个场景用一句简洁的中文描述（15-30字），要具体、有画面感，适合AI绘画生成。

文章内容：
${testArticle}

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

  console.log('LLM返回:', response);

  let scenes;
  try {
    scenes = JSON.parse(response.trim());
  } catch (e) {
    console.error('❌ LLM返回的不是有效JSON，尝试提取...');
    // 尝试提取JSON部分
    const match = response.match(/\[.*\]/s);
    if (match) {
      scenes = JSON.parse(match[0]);
    } else {
      throw new Error('无法解析场景描述');
    }
  }

  console.log('\n✓ 提取到配图场景:', scenes);
  console.log('\n步骤2: 为第一个场景生成图片...');
  console.log('场景描述:', scenes[0]);

  // 步骤2: 调用通义万相生成图片
  const API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';

  const imageResponse = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${imageKey}`,
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify({
      model: 'wanx-v1',
      input: {
        prompt: scenes[0]
      },
      parameters: {
        style: '<auto>',
        size: '1024*1024',
        n: 1
      }
    })
  });

  const imageResult = await imageResponse.json();
  console.log('通义万相响应:', imageResult);

  if (imageResult.output && imageResult.output.task_id) {
    console.log('\n✓ 任务已提交，任务ID:', imageResult.output.task_id);
    console.log('任务状态:', imageResult.output.task_status);

    if (imageResult.output.task_status === 'PENDING') {
      console.log('\n⏳ 开始轮询任务状态（最多等待60秒）...');

      // 轮询任务状态
      const TASK_URL = `https://dashscope.aliyuncs.com/api/v1/tasks/${imageResult.output.task_id}`;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        const statusResponse = await fetch(TASK_URL, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${imageKey}`
          }
        });

        const statusResult = await statusResponse.json();
        console.log(`  [${attempts}/${maxAttempts}] 状态:`, statusResult.output.task_status);

        if (statusResult.output.task_status === 'SUCCEEDED') {
          console.log('\n✅ 图片生成成功！');
          console.log('图片URL:', statusResult.output.results[0].url);
          console.log('\n🎉 完整流程测试通过！');
          process.exit(0);
        } else if (statusResult.output.task_status === 'FAILED') {
          console.error('\n❌ 图片生成失败');
          console.error('失败原因:', statusResult.output);
          process.exit(1);
        }
      }

      console.error('\n❌ 超时：任务在60秒内未完成');
    }
  } else {
    console.error('❌ 未获取到任务ID');
  }

} catch (error) {
  console.error('\n❌ 测试失败:', error.message);
  console.error(error);
}
