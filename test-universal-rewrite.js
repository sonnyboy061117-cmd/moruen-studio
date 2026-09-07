// 测试万能改写重构效果
// 对比：旧版逐句替换 vs 新版两阶段提炼重组

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

async function testUniversalRewrite() {
  console.log('🧪 测试万能改写重构效果\n');
  console.log('📄 原文段落结构：');
  const originalParagraphs = testArticle.trim().split('\n\n').filter(p => p.trim());
  originalParagraphs.forEach((p, i) => {
    const preview = p.trim().substring(0, 50).replace(/\n/g, ' ');
    console.log(`  ${i + 1}. ${preview}...`);
  });

  console.log('\n🔄 开始测试改写...\n');

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
      console.error('❌ 改写失败:', result.error || '未知错误');
      return;
    }

    console.log('✅ 改写完成！\n');
    console.log('📊 改写结果分析：');
    console.log(`  AI味分数: ${result.score}%`);
    console.log(`  原文长度: ${testArticle.length} 字`);
    console.log(`  改写长度: ${result.text.length} 字`);
    console.log(`  长度变化: ${((result.text.length - testArticle.length) / testArticle.length * 100).toFixed(1)}%`);

    console.log('\n📄 改写后段落结构：');
    const rewrittenParagraphs = result.text.trim().split('\n\n').filter(p => p.trim());
    rewrittenParagraphs.forEach((p, i) => {
      const preview = p.trim().substring(0, 50).replace(/\n/g, ' ');
      console.log(`  ${i + 1}. ${preview}...`);
    });

    console.log('\n🔍 结构对比分析：');
    console.log(`  原文段落数: ${originalParagraphs.length}`);
    console.log(`  改写段落数: ${rewrittenParagraphs.length}`);

    // 检查开头方式
    const origStart = originalParagraphs[0].substring(0, 30);
    const rewriteStart = rewrittenParagraphs[0].substring(0, 30);
    console.log(`\n  原文开头: ${origStart}...`);
    console.log(`  改写开头: ${rewriteStart}...`);

    const origStartsWith故事 = /^(信任|我认识|有一次|那天)/.test(originalParagraphs[0]);
    const rewriteStartsWith提问 = /[？?]/.test(rewrittenParagraphs[0].substring(0, 100));
    const rewriteStartsWith故事 = /^(信任|我认识|有一次|那天|小语)/.test(rewrittenParagraphs[0]);

    console.log(`\n  开头方式变化: ${origStartsWith故事 ? '故事场景' : '其他'} → ${rewriteStartsWith提问 ? '问题提问' : rewriteStartsWith故事 ? '故事场景' : '其他'}`);

    // 检查关键事实是否保留
    console.log('\n✅ 关键事实保留检查：');
    const keyFacts = [
      { fact: '小语', present: result.text.includes('小语') },
      { fact: '留学业务', present: result.text.includes('留学') },
      { fact: '签证', present: result.text.includes('签证') },
      { fact: '一个月/30天', present: result.text.includes('一个月') || result.text.includes('30天') },
      { fact: '移民局', present: result.text.includes('移民局') },
      { fact: '猕猴桃', present: result.text.includes('猕猴桃') },
      { fact: '三年', present: result.text.includes('三年') }
    ];

    keyFacts.forEach(({ fact, present }) => {
      console.log(`  ${present ? '✓' : '✗'} ${fact}: ${present ? '已保留' : '⚠️ 缺失'}`);
    });

    console.log('\n📝 改写全文预览（前500字）：');
    console.log('─────────────────────────────────────');
    console.log(result.text.substring(0, 500) + '...');
    console.log('─────────────────────────────────────\n');

    console.log('🎯 测试结论：');
    const structureChanged = originalParagraphs.length !== rewrittenParagraphs.length ||
                            origStart !== rewriteStart;
    const factsPreserved = keyFacts.filter(f => f.present).length >= 6;

    console.log(`  ${structureChanged ? '✅' : '❌'} 结构重组: ${structureChanged ? '段落顺序/开头方式已改变' : '结构基本相同'}`);
    console.log(`  ${factsPreserved ? '✅' : '❌'} 事实保留: ${keyFacts.filter(f => f.present).length}/${keyFacts.length} 项关键事实保留`);

    if (structureChanged && factsPreserved) {
      console.log('\n✅ 重构成功！万能改写已从"逐句替换"升级为"两阶段提炼重组"');
    } else {
      console.log('\n⚠️ 需要进一步检查改写效果');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testUniversalRewrite();
