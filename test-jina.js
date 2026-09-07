// 测试 Jina Reader API 对公众号文章的抓取能力

const testUrls = [
  // 这里需要真实的公众号链接进行测试
  // 由于我没有真实链接，先测试API是否可用
  'https://mp.weixin.qq.com/s/test123'
];

async function testJinaReader(url) {
  console.log(`\n测试: ${url}`);
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    console.log(`Jina URL: ${jinaUrl}`);

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain'
      },
      timeout: 10000
    });

    console.log(`状态码: ${response.status}`);
    console.log(`状态文本: ${response.statusText}`);

    const text = await response.text();
    console.log(`返回内容长度: ${text.length}`);
    console.log(`返回内容前500字符:\n${text.substring(0, 500)}`);

    // 检查是否包含错误信息
    if (text.includes('error') || text.includes('Error') || text.includes('failed')) {
      console.log('❌ 可能包含错误');
    } else if (text.length > 200) {
      console.log('✅ 抓取成功');
    } else {
      console.log('⚠️ 内容过短，可能失败');
    }

    return { ok: text.length > 200, length: text.length };
  } catch (e) {
    console.log(`❌ 错误: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

async function testJinaAPI() {
  console.log('=== 开始测试 Jina Reader API ===\n');

  // 先测试一个普通网页看API是否工作
  console.log('1. 测试普通网页（验证API可用性）:');
  await testJinaReader('https://example.com');

  console.log('\n\n2. 测试公众号链接（需要真实链接）:');
  console.log('注意：这个测试链接是虚构的，需要替换成真实的公众号文章链接');
  for (const url of testUrls) {
    await testJinaReader(url);
  }

  console.log('\n\n=== Jina Reader 服务说明 ===');
  console.log('官网: https://jina.ai/reader');
  console.log('免费额度: 需要查看官方文档确认');
  console.log('使用方式: https://r.jina.ai/{目标URL}');
}

testJinaAPI().catch(console.error);
