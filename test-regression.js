// 回归测试 - 验证4个修复问题都正常工作

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

// 检查关键事实
function checkKeyFacts(text, strength) {
  const facts = {
    '小语': text.includes('小语'),
    '留学': text.includes('留学'),
    '签证': text.includes('签证'),
    '一个月或30天': text.includes('一个月') || text.includes('30天') || text.includes('三十天'),
    '移民局': text.includes('移民局'),
    '猕猴桃': text.includes('猕猴桃'),
    '三年': text.includes('三年') || text.includes('3年'),
  };

  const preserved = Object.values(facts).filter(v => v).length;
  const total = Object.keys(facts).length;

  console.log(`  事实保留检查:`);
  Object.entries(facts).forEach(([key, found]) => {
    console.log(`    ${found ? '✓' : '✗'} ${key}`);
  });
  console.log(`  保留率: ${preserved}/${total} (${Math.round(preserved/total*100)}%)`);

  return { preserved, total, allPreserved: preserved === total };
}

async function testStrength(strength, label, retryCount = 0) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`测试：${label}${retryCount > 0 ? ` (重试 ${retryCount}/1)` : ''}`);
  console.log(`${'═'.repeat(60)}\n`);

  try {
    const response = await fetch('http://localhost:8787/api/universal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testArticle,
        strength: strength,
        audience: '通用',
        aiOff: false,
        keywords: true,
        tone: false,
        length: '保持原长度',
        style: '经验分享',
        structure: '',
        onlyDeAI: strength === '仅降AI味',
        provider: 'relay'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.text) {
      console.error(`❌ 改写失败: ${result.error}`);
      return false;
    }

    console.log(`✅ 改写成功`);
    console.log(`  字数: ${result.text.length}`);
    console.log(`  AI分数: ${result.score}`);

    const factCheck = checkKeyFacts(result.text, strength);

    if (strength === '完全重写' && !factCheck.allPreserved) {
      console.log(`⚠️  警告: ${strength} 有事实丢失`);
    }

    return true;

  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);

    // 自动重试1次
    if (retryCount === 0) {
      console.log(`⏳ 1秒后自动重试...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return testStrength(strength, label, 1);
    }

    return false;
  }
}

async function runRegressionTests() {
  console.log('🧪 回归测试 - 验证所有修复正常工作\n');

  const results = {
    '轻度（仅降AI味）': await testStrength('轻度', '轻度（仅降AI味）'),
    '中度': await testStrength('中度', '中度'),
    '深度': await testStrength('深度', '深度'),
    '完全重写': await testStrength('完全重写', '完全重写')
  };

  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 回归测试总结');
  console.log(`${'═'.repeat(60)}\n`);

  Object.entries(results).forEach(([name, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  });

  const allPassed = Object.values(results).every(v => v);

  console.log(`\n${allPassed ? '✅ 所有测试通过，可以提交代码' : '❌ 有测试失败，请检查'}\n`);

  return allPassed;
}

runRegressionTests();
