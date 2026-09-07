// 测试三档改写是否还有编造精确细节的问题

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

// 原文中的模糊表述（不能被精确化）
const fuzzyExpressions = {
  '好几个月': ['三个月', '四个月', '五个月', /\d+个月/], // "数月"是合法的模糊表述，不算编造
  '发着高烧': ['39度', '三十九度', '高烧39', /\d+度/, /体温/],
  '轰炸': [/\d+通/, /\d+次/, /连打\d+/, /第\d+通/],
  '晚上10点多': ['10点20', '10点47', '十点二十', '十点四十', /10[:：点]\d{2}/],
  '周末晚上八九点': ['周末晚上8点', '周末晚上9点', /[89][:：点]\d{2}/]
};

// 必须保留的关键词
const requiredKeywords = {
  '留学': '业务类型',
  '资源方': '关系称谓（不能改成"渠道合伙人"或"合伙人"）',
  '小语': '人名',
  '移民局': '机构名',
  '一个月': '时长（或"30天"）',
  '三年': '时长',
  '猕猴桃': '具体物品'
};

// 禁止编造的引语（原文没有的直接引语）
const fabricatedQuotes = [
  /小语说[：:][""]/, // 小语说："XXX"
  /她[对跟和]我说[：:][""]/, // 她对我说："XXX"
  /资源方.*?说[：:][""]/ // 资源方XXX说："XXX"
];

async function testStrength(strength) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 测试强度：${strength}`);
  console.log('='.repeat(80));

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
  const result = data.text || data.result || data.output || '';

  console.log('\n📝 改写结果：');
  console.log('-'.repeat(80));
  console.log(result);
  console.log('-'.repeat(80));

  let hasIssue = false;

  // 检查是否有编造的精确细节
  console.log('\n🔍 检查编造精确细节：');
  for (const [fuzzy, precisePatterns] of Object.entries(fuzzyExpressions)) {
    for (const pattern of precisePatterns) {
      if (typeof pattern === 'string') {
        if (result.includes(pattern)) {
          console.log(`  ❌ 将"${fuzzy}"编造成"${pattern}"`);
          hasIssue = true;
        }
      } else if (pattern instanceof RegExp) {
        const match = result.match(pattern);
        if (match) {
          console.log(`  ❌ 将"${fuzzy}"编造成精确表述: "${match[0]}"`);
          hasIssue = true;
        }
      }
    }
  }
  if (!hasIssue) {
    console.log('  ✅ 未发现模糊表述被精确化');
  }

  // 检查关键词保留
  console.log('\n✅ 关键词保留检查：');
  let missingCount = 0;
  for (const [keyword, desc] of Object.entries(requiredKeywords)) {
    if (keyword === '一个月') {
      // "一个月"或"30天"都可以
      if (result.includes('一个月') || result.includes('30天') || result.includes('三十天')) {
        console.log(`  ✓ ${desc}: 已保留 (${keyword}或30天)`);
      } else {
        console.log(`  ✗ ${desc}: 丢失`);
        missingCount++;
      }
    } else {
      if (result.includes(keyword)) {
        console.log(`  ✓ ${desc}: 已保留`);
      } else {
        console.log(`  ✗ ${desc}: 丢失`);
        missingCount++;
      }
    }
  }

  // 特别检查"资源方"是否被改成了"合伙人"
  if (result.includes('合伙人') && !result.includes('资源方')) {
    console.log(`  ❌ "资源方"被错误替换成"合伙人"（改变了关系性质）`);
    hasIssue = true;
  }

  // 检查是否编造了人物引语
  console.log('\n🔍 检查编造引语：');
  let hasQuote = false;
  for (const pattern of fabricatedQuotes) {
    const match = result.match(pattern);
    if (match) {
      console.log(`  ❌ 发现编造的人物引语: "${match[0]}..."`);
      hasIssue = true;
      hasQuote = true;
    }
  }
  if (!hasQuote) {
    console.log('  ✅ 未发现编造的人物引语');
  }

  console.log('\n' + '='.repeat(80));
  if (hasIssue || missingCount > 0) {
    console.log(`❌ ${strength} - 测试失败`);
  } else {
    console.log(`✅ ${strength} - 测试通过`);
  }
  console.log('='.repeat(80));
}

async function runAllTests() {
  console.log('🧪 编造细节检测 - 三档强度对比测试');
  console.log('测试时间:', new Date().toLocaleString('zh-CN'));
  console.log('\n原文模糊表述（必须保持模糊）：');
  console.log('  - "好几个月" → 不能变成"四个月"');
  console.log('  - "发着高烧" → 不能变成"39度"');
  console.log('  - "轰炸" → 不能变成具体次数');
  console.log('  - "晚上10点多" → 不能变成"10点47分"');
  console.log('  - "周末晚上八九点" → 不能变成精确时刻');

  try {
    await testStrength('中度');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await testStrength('深度');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await testStrength('完全重写');
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    process.exit(1);
  }
}

runAllTests();
