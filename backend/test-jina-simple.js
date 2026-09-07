// 简单测试 Jina Reader
async function test() {
  console.log('测试 Jina Reader API...\n');

  // 测试1: 普通网页
  try {
    const url1 = 'https://r.jina.ai/https://example.com';
    console.log(`请求: ${url1}`);
    const res1 = await fetch(url1, { signal: AbortSignal.timeout(8000) });
    console.log(`状态码: ${res1.status}`);
    const text1 = await res1.text();
    console.log(`内容长度: ${text1.length}`);
    console.log(`前200字符: ${text1.substring(0, 200)}\n`);
  } catch (e) {
    console.log(`❌ 测试1失败: ${e.message}\n`);
  }

  // 官方文档检查
  console.log('=== Jina Reader 服务说明 ===');
  console.log('需要检查官方文档:');
  console.log('- 是否需要API key');
  console.log('- 免费额度限制');
  console.log('- 对公众号的支持情况');
}

test().catch(console.error);
