// 测试强化后的深度改写 - 验证段落顺序是否真正改变

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

// 原文段落结构分析
const originalParagraphs = [
  { id: 1, type: '标题', content: '如何成功挽回失去信任的资源方' },
  { id: 2, type: '引语', content: '信任这东西，碎了再粘，裂缝还在...' },
  { id: 3, type: '介绍主角', content: '我认识的小语就做到了这一点...' },
  { id: 4, type: '事件起因', content: '事情的起因其实挺常见：一个学生的签证...' },
  { id: 5, type: '常规做法对比', content: '换成很多人，这种情况可能就放弃了...' },
  { id: 6, type: '主角做法', content: '但小语选择了一条最笨也最管用的路...' },
  { id: 7, type: '做法细节', content: '重点不在于催签本身有没有用，而在于...' },
  { id: 8, type: '结果', content: '最后签证是下来了，但学生已经错过了...' },
  { id: 9, type: '启发', content: '这件事给我最大的启发是：当你已经失去信任...' },
  { id: 10, type: '总结', content: '新人在职场上常常会遇到这类问题...' }
];

async function testDeepRewrite() {
  console.log('🧪 测试强化后的深度改写 - 验证段落顺序重组\n');
  console.log('📄 原文段落结构（共10段）：');
  originalParagraphs.forEach(p => {
    console.log(`  ${p.id}. ${p.type} - ${p.content.substring(0, 30)}...`);
  });

  console.log('\n🔄 开始深度改写（问题拆解型）...\n');

  try {
    const response = await fetch('http://localhost:8787/api/universal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testArticle,
        strength: '深度',
        audience: '通用',
        aiOff: false,
        keywords: true,
        tone: false,
        length: '保持原长度',
        style: '经验分享',
        structure: '问题拆解',
        onlyDeAI: false,
        provider: 'relay',
        demo: true
      })
    });

    const result = await response.json();

    if (!result.text) {
      console.error('❌ 改写失败:', result.error || result);
      return;
    }

    console.log('✅ 改写完成！\n');

    // 分析改写后的段落结构
    const rewrittenParagraphs = result.text.trim().split('\n\n').filter(p => p.trim().length > 0);

    console.log('📊 改写后段落结构（共' + rewrittenParagraphs.length + '段）：');
    rewrittenParagraphs.forEach((p, i) => {
      const preview = p.trim().substring(0, 50).replace(/\n/g, ' ');
      console.log(`  ${i + 1}. ${preview}...`);
    });

    // 检查开头方式
    console.log('\n🔍 开头方式检查：');
    const firstPara = rewrittenParagraphs[0];
    const isReversed = /最后|结果|三年|猕猴桃/.test(firstPara.substring(0, 100));
    const isCounterIntuitive = /不是|不该|反而|其实|说白了/.test(firstPara.substring(0, 100));
    const isChronological = /起因|开始|当时|那天/.test(firstPara.substring(0, 100));

    console.log(`  倒叙式（先说结果）: ${isReversed ? '✓ 是' : '✗ 否'}`);
    console.log(`  反常识观点式: ${isCounterIntuitive ? '✓ 是' : '✗ 否'}`);
    console.log(`  按时间线讲述（应避免）: ${isChronological ? '✗ 是（未达标）' : '✓ 否（通过）'}`);

    // 检查关键事实是否保留
    console.log('\n✅ 关键事实保留检查：');
    const keyFacts = [
      { fact: '小语', present: result.text.includes('小语') },
      { fact: '留学', present: result.text.includes('留学') },
      { fact: '签证', present: result.text.includes('签证') },
      { fact: '一个月/30天', present: result.text.includes('一个月') || result.text.includes('30天') },
      { fact: '移民局', present: result.text.includes('移民局') },
      { fact: '猕猴桃', present: result.text.includes('猕猴桃') },
      { fact: '三年', present: result.text.includes('三年') },
      { fact: '周末晚上八九点', present: /周末.*[八九]点|晚上.*[八九]点/.test(result.text) },
      { fact: '晚上10点多', present: /10点|十点/.test(result.text) }
    ];

    keyFacts.forEach(({ fact, present }) => {
      console.log(`  ${present ? '✓' : '✗'} ${fact}: ${present ? '已保留' : '⚠️ 缺失'}`);
    });

    const preservedCount = keyFacts.filter(f => f.present).length;
    console.log(`\n  保留率: ${preservedCount}/${keyFacts.length} (${Math.round(preservedCount/keyFacts.length*100)}%)`);

    // 段落对比分析
    console.log('\n📋 段落对比分析（原文 → 改写）：');
    console.log('─────────────────────────────────────');

    // 尝试识别改写后的段落对应原文哪一段
    console.log('\n改写后各段落内容来源分析：');
    rewrittenParagraphs.forEach((p, i) => {
      const keywords = {
        '结果/猕猴桃': /猕猴桃|三年|道歉/.test(p),
        '启发/核心观点': /信任|持续|可见|行动/.test(p) && /空口承诺/.test(p),
        '做法细节': /电话|截图|实时|30天|一个月/.test(p),
        '主角做法': /每天|打电话|移民局/.test(p),
        '事件起因': /签证|家长|周末|晚上|拉黑/.test(p),
        '常规做法对比': /换成|很多人|放弃|时间冲淡/.test(p),
        '介绍主角': /小语|留学业务|资源方|合作/.test(p),
      };

      const matchedTypes = Object.entries(keywords)
        .filter(([type, test]) => test)
        .map(([type]) => type);

      console.log(`  改写第${i+1}段: ${matchedTypes.length > 0 ? matchedTypes.join(' + ') : '新增内容'}`);
    });

    // 结论
    console.log('\n🎯 测试结论：');
    const structureChanged = rewrittenParagraphs.length !== originalParagraphs.length ||
                             (isReversed || isCounterIntuitive) && !isChronological;
    const factsPreserved = preservedCount >= 7;

    console.log(`  ${structureChanged ? '✅' : '❌'} 结构重组: ${structureChanged ? '开头方式已改变，非按时间线' : '仍按时间线讲述'}`);
    console.log(`  ${factsPreserved ? '✅' : '❌'} 事实保留: ${preservedCount}/${keyFacts.length} 项关键事实保留`);

    if (structureChanged && factsPreserved) {
      console.log('\n✅ 强化成功！段落结构已重组，开头方式改变');
    } else {
      console.log('\n⚠️ 仍需优化：');
      if (!structureChanged) console.log('  - 开头仍按时间线讲述，未采用倒叙或反常识观点');
      if (!factsPreserved) console.log('  - 关键事实保留不完整');
    }

    console.log('\n📝 改写全文：');
    console.log('═════════════════════════════════════');
    console.log(result.text);
    console.log('═════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testDeepRewrite();
