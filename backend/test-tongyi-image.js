// 测试通义万相API是否可用
import { getKey } from './lib/keys.js';

const imageKey = getKey('tongyi-wanxiang');

if (!imageKey) {
  console.error('❌ 未配置通义万相API密钥');
  process.exit(1);
}

console.log('✓ 密钥已配置');
console.log('测试调用通义万相API生成图片...\n');

const testPrompt = '一只可爱的小猫咪，坐在窗台上看风景，温馨的室内场景';

try {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${imageKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify({
      model: 'wanx-v1',
      input: {
        prompt: testPrompt
      },
      parameters: {
        size: '1024*1024',
        n: 1
      }
    })
  });

  const result = await response.json();

  console.log('响应状态:', response.status);
  console.log('响应内容:', JSON.stringify(result, null, 2));

  if (response.status === 200 && result.output) {
    console.log('\n✅ API调用成功！');
    console.log('任务ID:', result.output.task_id);
    console.log('任务状态:', result.output.task_status);

    if (result.output.task_status === 'SUCCEEDED') {
      console.log('图片URL:', result.output.results?.[0]?.url);
    } else if (result.output.task_status === 'PENDING') {
      console.log('⏳ 任务排队中，需要轮询查询结果');
    }
  } else {
    console.error('\n❌ API调用失败');
    if (result.code === 'InvalidApiKey') {
      console.error('原因: API Key无效');
    } else if (result.code === 'InsufficientBalance') {
      console.error('原因: 账号余额不足，请充值');
    } else if (result.message) {
      console.error('原因:', result.message);
    }
  }
} catch (error) {
  console.error('\n❌ 网络请求失败:', error.message);
}
