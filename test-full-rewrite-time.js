// 单独测试完全重写 - 验证时间信息保留

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

// 关键时间信息检测
const timeKeywords = [
  { key: '一个月', variants: ['一个月', '1个月', '整整一个月', '满一个月'] },
  { key: '30天', variants: ['30天', '三十天', '整整30天', '整整三十天'] },
  { key: '三年', variants: ['三年', '3年', '连续三年', '连续3年'] },
  { key: '每天', variants: ['每天', '一天不落', '天天', '每日'] },
  { key: '周末晚上八九点', variants: ['周末晚上八九点', '周末晚上8点', '周末晚上9点', '周末.*晚上.*八.*点', '周末.*晚上.*九.*点'] },
  { key: '晚上10点多', variants: ['晚上10点', '晚上十点', '夜里10点', '夜里十点'] }
];

function checkTimeInfo(text) {
  const results = [];

  timeKeywords.forEach(({ key, variants }) => {
    let found = false;
    let matchedVariant = '';

    for (const variant of variants) {
      if (variant.includes('.*')) {
        // 正则匹配
        const regex = new RegExp(variant);
        if (regex.test(text)) {
          found = true;
          matchedVariant = variant;
          break;
        }
      } else {
        // 直接字符串匹配
        if (text.includes(variant)) {
          found = true;
          matchedVariant = variant;
          break;
        }
      }
    }

    results.push({
      keyword: key,
      found: found,
      variant: matchedVariant || '未找到'
    });
  });

  return results;
}

async function testFullRewrite() {
  console.log('🧪 完全重写测试 - 时间信息保留验证\n');

  try {
    const response = await fetch('http://localhost:8787/api/universal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testArticle,
        strength: '完全重写',
        audience: '通用',
        aiOff: false,
        keywords: true,
        tone: false,
        length: '保持原长度',
        style: '经验分享',
        structure: '',
        onlyDeAI: false,
        provider: 'relay'
      })
    });

    if (!response.ok) {
      console.error('❌ HTTP错误:', response.status);
      return;
    }

    const result = await response.json();

    if (!result.text) {
      console.error('❌ 改写失败:', result.error);
      return;
    }

    console.log('✅ 改写完成！\n');
    console.log('📊 字数统计:');
    console.log(`  原文: ${testArticle.length}字`);
    console.log(`  改写: ${result.text.length}字\n`);

    // 检测时间信息
    console.log('⏰ 关键时间信息保留检查:\n');
    const timeCheck = checkTimeInfo(result.text);

    timeCheck.forEach(({ keyword, found, variant }) => {
      const status = found ? '✓' : '✗';
      const display = found ? `${status} ${keyword}: 已保留（表述为"${variant}"）` : `${status} ${keyword}: ⚠️ 缺失`;
      console.log(`  ${display}`);
    });

    const preservedCount = timeCheck.filter(t => t.found).length;
    const totalCount = timeCheck.length;
    console.log(`\n  保留率: ${preservedCount}/${totalCount} (${Math.round(preservedCount/totalCount*100)}%)\n`);

    // 特别关注"一个月/30天"
    const monthFound = timeCheck.find(t => t.keyword === '一个月').found;
    const daysFound = timeCheck.find(t => t.keyword === '30天').found;

    if (monthFound || daysFound) {
      console.log('✅ 核心时长信息（一个月/30天）已保留\n');
    } else {
      console.log('❌ 核心时长信息（一个月/30天）缺失 - 这是BUG需要修复\n');
    }

    // 显示改写全文
    console.log('📝 改写全文:');
    console.log('─'.repeat(80));
    console.log(result.text);
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testFullRewrite();
