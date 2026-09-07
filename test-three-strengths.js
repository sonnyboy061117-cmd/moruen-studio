// 三档强度对比测试 - 资源方案例
// 测试：中度、深度、完全重写

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

// 原文段落结构（用于对比）
const originalStructure = [
  { id: 1, type: '标题', keywords: ['挽回', '信任', '资源方'] },
  { id: 2, type: '引语', keywords: ['信任', '碎了', '裂缝', '磨平'] },
  { id: 3, type: '介绍主角', keywords: ['小语', '留学业务', '资源方', '签证事件'] },
  { id: 4, type: '事件起因', keywords: ['学生', '签证', '家长', '周末', '晚上', '拉黑'] },
  { id: 5, type: '常规做法对比', keywords: ['换成很多人', '放弃', '移民局', '时间冲淡'] },
  { id: 6, type: '主角做法', keywords: ['小语', '每天', '移民局', '打电话', '一个月'] },
  { id: 7, type: '做法细节', keywords: ['重点', '让对方看见', '截图', '实时', '30天'] },
  { id: 8, type: '结果', keywords: ['签证', '下来', '错过', '延期', '猕猴桃', '三年'] },
  { id: 9, type: '启发', keywords: ['失去信任', '空口承诺', '持续', '可见', '行动'] },
  { id: 10, type: '总结', keywords: ['新人', '职场', '试错', '代价', '经验'] }
];

// 匹配改写段落对应原文哪一段
function matchParagraph(para, originalStructure) {
  let maxScore = 0;
  let matchedId = 0;
  let matchedType = '新增内容';

  originalStructure.forEach(orig => {
    let score = 0;
    orig.keywords.forEach(kw => {
      if (para.includes(kw)) score++;
    });
    if (score > maxScore) {
      maxScore = score;
      matchedId = orig.id;
      matchedType = orig.type;
    }
  });

  if (maxScore === 0) return { id: 0, type: '新增内容' };
  if (maxScore <= 1) return { id: matchedId, type: matchedType, confidence: '低' };
  return { id: matchedId, type: matchedType, confidence: '高' };
}

// 测试单个强度（带重试）
async function testStrength(strength, retryCount = 0) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`🧪 测试强度：${strength}${retryCount > 0 ? ` (重试 ${retryCount}/1)` : ''}`);
  console.log(`${'═'.repeat(80)}\n`);

  try {
    const startTime = Date.now();
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
        structure: strength === '深度' ? '问题拆解' : '',
        onlyDeAI: false,
        provider: 'relay'
      })
    });

    // 检查 HTTP 状态
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    if (!result.text) {
      console.error('❌ 改写失败:', result.error || result);
      return null;
    }

    console.log(`✅ 改写完成！耗时：${duration}秒\n`);

    // 分析段落结构
    const paragraphs = result.text.trim().split('\n\n').filter(p => p.trim().length > 0);

    console.log(`📊 段落数量对比：原文 10段 → 改写 ${paragraphs.length}段\n`);

    // 分析每一段
    console.log('📋 段落对应关系（改写稿 → 原文）：');
    console.log('─'.repeat(80));

    const mapping = paragraphs.map((para, idx) => {
      const match = matchParagraph(para, originalStructure);
      const preview = para.substring(0, 60).replace(/\n/g, ' ');

      console.log(`\n改写第${idx + 1}段:`);
      console.log(`  内容预览: ${preview}...`);
      console.log(`  对应原文: ${match.id === 0 ? '新增内容' : `第${match.id}段（${match.type}）${match.confidence ? ` - 置信度${match.confidence}` : ''}`}`);

      return { idx: idx + 1, matchId: match.id, matchType: match.type, preview };
    });

    // 统计分析
    console.log('\n' + '─'.repeat(80));
    console.log('\n📈 统计分析：');

    const newContent = mapping.filter(m => m.matchId === 0).length;
    const reordered = mapping.filter((m, i) => m.matchId !== 0 && m.matchId !== (i + 1)).length;

    console.log(`  新增段落: ${newContent}段`);
    console.log(`  顺序改变: ${reordered}段`);
    console.log(`  结构保留: ${mapping.length - newContent - reordered}段`);

    // 顺序对比
    const orderMapping = mapping
      .filter(m => m.matchId !== 0)
      .map(m => m.matchId)
      .join(' → ');

    console.log(`\n  段落顺序: ${orderMapping || '无法识别'}`);
    console.log(`  原文顺序: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10`);

    // 检查开篇方式
    console.log('\n🔍 开篇方式分析：');
    const firstPara = paragraphs[0];
    const isReversed = /最后|结果|三年|猕猴桃|道歉/.test(firstPara.substring(0, 150));
    const isCounterIntuitive = /不是|不该|反而|其实|说白了|最不该|最管用的反而/.test(firstPara.substring(0, 150));
    const isQuestion = /[？?]/.test(firstPara.substring(0, 100));
    const isChronological = /起因|开始|当时|那天|有一次/.test(firstPara.substring(0, 100));

    console.log(`  倒叙式（先说结果）: ${isReversed ? '✓ 是' : '✗ 否'}`);
    console.log(`  反常识观点式: ${isCounterIntuitive ? '✓ 是' : '✗ 否'}`);
    console.log(`  提问式: ${isQuestion ? '✓ 是' : '✗ 否'}`);
    console.log(`  按时间线（应避免）: ${isChronological ? '✗ 是（未达标）' : '✓ 否（通过）'}`);

    // 关键事实检查
    console.log('\n✅ 关键事实保留检查：');
    const facts = [
      { name: '小语', present: result.text.includes('小语') },
      { name: '留学', present: result.text.includes('留学') },
      { name: '签证', present: result.text.includes('签证') },
      { name: '一个月/30天', present: result.text.includes('一个月') || result.text.includes('30天') },
      { name: '移民局', present: result.text.includes('移民局') },
      { name: '猕猴桃', present: result.text.includes('猕猴桃') },
      { name: '三年', present: result.text.includes('三年') },
      { name: '周末晚上八九点', present: /周末.*晚上|晚上.*八.*点|晚上.*九.*点/.test(result.text) },
      { name: '晚上10点多', present: /10点|十点/.test(result.text) }
    ];

    facts.forEach(f => {
      console.log(`  ${f.present ? '✓' : '✗'} ${f.name}: ${f.present ? '已保留' : '⚠️ 缺失'}`);
    });

    const preserved = facts.filter(f => f.present).length;
    console.log(`\n  保留率: ${preserved}/${facts.length} (${Math.round(preserved/facts.length*100)}%)`);

    // 改写全文
    console.log('\n📝 改写全文：');
    console.log('─'.repeat(80));
    console.log(result.text);
    console.log('─'.repeat(80));

    return {
      strength,
      duration,
      paragraphCount: paragraphs.length,
      newContent,
      reordered,
      preserved,
      openingStyle: isReversed ? '倒叙式' : isCounterIntuitive ? '反常识' : isQuestion ? '提问式' : isChronological ? '时间线' : '其他'
    };

  } catch (error) {
    console.error('❌ 测试失败:', error.message);

    // 如果是首次失败，自动重试1次
    if (retryCount === 0) {
      console.log('⏳ 1秒后自动重试...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return testStrength(strength, 1);
    }

    // 重试后仍失败，返回 null
    console.error('❌ 重试后仍然失败\n');
    return null;
  }
}

// 主测试流程
async function runAllTests() {
  console.log('🧪 三档强度对比测试 - 资源方案例');
  console.log('测试时间:', new Date().toLocaleString());
  console.log('\n原文段落结构（共10段）：');
  originalStructure.forEach(p => {
    console.log(`  ${p.id}. ${p.type}`);
  });

  const results = [];

  // 测试中度
  const medium = await testStrength('中度');
  if (medium) results.push(medium);

  await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒

  // 测试深度
  const deep = await testStrength('深度');
  if (deep) results.push(deep);

  await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒

  // 测试完全重写
  const full = await testStrength('完全重写');
  if (full) results.push(full);

  // 对比总结
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 三档强度对比总结');
  console.log('═'.repeat(80));
  console.log('\n| 指标 | 中度 | 深度 | 完全重写 |');
  console.log('|------|------|------|----------|');

  if (results.length === 3) {
    console.log(`| 耗时 | ${results[0].duration}秒 | ${results[1].duration}秒 | ${results[2].duration}秒 |`);
    console.log(`| 段落数 | ${results[0].paragraphCount} | ${results[1].paragraphCount} | ${results[2].paragraphCount} |`);
    console.log(`| 新增段落 | ${results[0].newContent} | ${results[1].newContent} | ${results[2].newContent} |`);
    console.log(`| 顺序改变 | ${results[0].reordered} | ${results[1].reordered} | ${results[2].reordered} |`);
    console.log(`| 开篇方式 | ${results[0].openingStyle} | ${results[1].openingStyle} | ${results[2].openingStyle} |`);
    console.log(`| 事实保留 | ${results[0].preserved}/9 | ${results[1].preserved}/9 | ${results[2].preserved}/9 |`);
  }

  console.log('\n🎯 测试结论：');
  console.log('- 中度改写应该：至少50%段落顺序改变，开篇方式不同');
  console.log('- 深度改写应该：结构类型改变，新增1段原创内容');
  console.log('- 完全重写应该：新增2段以上原创内容，段落结构完全不同');
  console.log('\n测试完成！请人工检查以上输出，确认是否达标。\n');
}

// 运行测试
runAllTests();
