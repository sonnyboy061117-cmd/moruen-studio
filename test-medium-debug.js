// 单独测试中度改写，捕获详细错误信息

const testArticle = `如何成功挽回失去信任的资源方

信任这东西，碎了再粘，裂缝还在。但有些人偏偏能把裂缝磨平，甚至让关系变得比从前更牢固。

我认识的小语就做到了这一点。她的留学业务主要靠一个资源方介绍客户，合作一直很顺利，直到那次签证事件彻底搞砸了。

事情的起因其实挺常见：一个学生的签证递交了好几个月都没消息，家长急了，周末晚上八九点开始轰炸资源方。偏偏资源方那天发着高烧，扛着巨大的压力想找小语团队商量对策，结果消息发出去石沉大海——小语直到晚上10点多才看到，那会儿资源方已经把电话拉黑了。

换成很多人，这种情况可能就放弃了。毕竟签证审批是移民局的事，催也催不动，还不如等着时间冲淡矛盾。

但小语选择了一条最笨也最管用的路：每天给移民局打电话，打了整整一个月。

重点不在于催签本身有没有用，而在于她做到了"让对方看见"。每一通电话打完，不管移民局的回复是不是和昨天一模一样，她都会把通话截图和结果实时发给资源方。30天，没有一天间断。

最后签证是下来了，但学生已经错过了那个学期的入学时间，只能延期到下一年。按理说这个结果并不完美，可资源方不仅没有继续追究，反而主动给小语道歉，还连续三年每到八九月份就寄一大箱猕猴桃过来。

这件事给我最大的启发是：当你已经失去信任的时候，空口承诺没有任何意义，唯一能做的就是用持续的、可见的行动把信任一点点补回来。哪怕结果不在你的控制范围内，但只要你能证明"该做的我都做了"，对方就没办法再怪你。

新人在职场上常常会遇到这类问题，却很少有人告诉他们具体该怎么办。试错的代价太高，有时候一次失误就能毁掉一个重要的合作关系。所以我把小语的经验分享出来，希望能帮到更多人少走弯路。`;

async function testMediumRewrite() {
  console.log('🧪 测试中度改写 - 详细错误诊断\n');

  const url = 'http://localhost:8787/api/universal';
  const payload = {
    text: testArticle,
    strength: '中度',
    audience: '通用',
    aiOff: false,
    keywords: true,
    tone: false,
    length: '保持原长度',
    style: '经验分享',
    structure: '',
    onlyDeAI: false,
    provider: 'relay'
  };

  console.log('📤 请求URL:', url);
  console.log('📦 请求参数:', JSON.stringify(payload, null, 2));
  console.log('\n⏳ 发送请求中...\n');

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const endTime = Date.now();
    console.log(`⏱️  响应时间: ${((endTime - startTime) / 1000).toFixed(1)}秒`);
    console.log(`📊 HTTP状态码: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ HTTP错误响应:');
      console.error('状态码:', response.status);
      console.error('响应体:', errorText);
      return;
    }

    const result = await response.json();

    if (result.error) {
      console.error('\n❌ API返回错误:');
      console.error('错误信息:', result.error);
      console.error('详细信息:', result.detail);
      return;
    }

    console.log('\n✅ 改写成功！');
    console.log('字数:', result.text.length);
    console.log('AI分数:', result.score);
    console.log('\n改写结果预览（前200字）:');
    console.log(result.text.substring(0, 200) + '...');

  } catch (error) {
    const endTime = Date.now();
    console.error(`\n❌ 请求失败 (耗时: ${((endTime - startTime) / 1000).toFixed(1)}秒)`);
    console.error('错误类型:', error.constructor.name);
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    // 额外诊断信息
    if (error.message.includes('fetch failed')) {
      console.error('\n🔍 fetch failed 诊断:');
      console.error('- 这通常表示网络层连接失败');
      console.error('- 可能原因:');
      console.error('  1. 后端服务未启动或崩溃');
      console.error('  2. 端口8787被占用或无法访问');
      console.error('  3. 请求超时（默认超时时间）');
      console.error('  4. 中转API连接失败');
    }

    if (error.cause) {
      console.error('\n📋 底层错误原因:');
      console.error(error.cause);
    }
  }
}

testMediumRewrite();
