// 回归测试：验证修复后的4个问题
import fetch from 'node-fetch';

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

async function testStrength(strength, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试 ${label} (${strength})`);
  console.log('='.repeat(60));

  try {
    const response = await fetch('http://localhost:8787/api/universal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testArticle,
        strength: strength,
        structure: '结论先行',
        style: '真实案例风格'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.text || '';

    // 检查关键词保留
    const hasKeywords = result.includes('留学') && 
                       result.includes('资源方') && 
                       result.includes('小语') && 
                       result.includes('移民局');
    
    // 检查没有编造精确细节
    const noFabrication = !result.match(/四个月|三个月|五个月/) &&
                         !result.match(/39度|三十九度/) &&
                         !result.match(/10[:：点]\d{2}/);

    console.log(`✓ 返回结果长度: ${result.length} 字`);
    console.log(`✓ 关键词保留: ${hasKeywords ? '正常' : '❌ 异常'}`);
    console.log(`✓ 无编造细节: ${noFabrication ? '正常' : '❌ 异常'}`);
    console.log(`✓ AI味分数: ${data.score}%`);

    return hasKeywords && noFabrication;
  } catch (err) {
    console.error(`❌ 测试失败: ${err.message}`);
    return false;
  }
}

async function testDeAI() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试 仅降AI味`);
  console.log('='.repeat(60));

  try {
    const response = await fetch('http://localhost:8787/api/universal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testArticle,
        onlyDeAI: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.text || '';

    console.log(`✓ 返回结果长度: ${result.length} 字`);
    console.log(`✓ AI味分数: ${data.score}%`);
    console.log(`✓ 功能正常: 是`);

    return true;
  } catch (err) {
    console.error(`❌ 测试失败: ${err.message}`);
    return false;
  }
}

async function runRegression() {
  console.log('🧪 回归测试 - 验证4个问题修复');
  console.log('测试时间:', new Date().toLocaleString('zh-CN'));

  const results = {
    medium: await testStrength('中度', '中度改写'),
    deep: await testStrength('深度', '深度改写'),
    complete: await testStrength('完全重写', '完全重写'),
    deai: await testDeAI()
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 回归测试结果');
  console.log('='.repeat(60));
  console.log(`中度改写: ${results.medium ? '✅ 通过' : '❌ 失败'}`);
  console.log(`深度改写: ${results.deep ? '✅ 通过' : '❌ 失败'}`);
  console.log(`完全重写: ${results.complete ? '✅ 通过' : '❌ 失败'}`);
  console.log(`仅降AI味: ${results.deai ? '✅ 通过' : '❌ 失败'}`);

  const allPassed = Object.values(results).every(r => r);
  console.log(`\n总结: ${allPassed ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);
  console.log('='.repeat(60));

  process.exit(allPassed ? 0 : 1);
}

runRegression();
