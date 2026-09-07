// 使用内置 fetch (Node 18+)

const testArticle = `信任一旦破裂，空口承诺毫无意义

"当你失去对方信任的时候，你的承诺和解释毫无意义，唯一能让对方信任你的，就是做出可被看见的努力，并且不断地告诉对方你努力的结果，哪怕这个结果并不完美。"

我有一位朋友小语，她从事留学业务，客户主要通过一位资源方介绍，合作非常顺利，直到那次签证事件导致关系彻底破裂。

起因很常见：一个学生的签证递交后数月无音讯，家长焦急万分，周末晚上八九点开始疯狂联系资源方。偏偏那天资源方正在发高烧，承受巨大压力，想联系小语团队商讨对策，然而消息发出后没有回应——小语直到晚上10点多才看到信息，此时资源方已将其拉黑。

大多数人会认为，签证审批属于移民局职责，催促无济于事，甚至会反感对方不理解自己。然而小语的做法完全不同，这种做法后来让双方关系变得更加牢固。

她采取的方法是：每天给移民局打电话，打了整整一个月。

你可能会质疑，催促签证有效吗？事实上，关键并非催促签证的效果，而在于"让对方看见你的努力"。每次通话后，无论移民局的回复与前一天是否相同，她都会将通话记录和结果实时发送给资源方。持续30天，从未间断。试想，一个人在发高烧和被拉黑的愤怒中，突然收到这样连续不断的"证据链"，会是什么感受？她并非要证明自己能够搞定签证，而是证明：即使无法搞定，她也在竭尽全力让对方知晓每一步进展。

最终签证获批，但学生已错过该学期入学时间，只能延期至下一年。按理说，结果并不完美，换做他人可能仍会受到责备。然而资源方不仅未继续追究，反而主动向小语道歉，此后连续三年每到八九月份都会寄来一大箱猕猴桃——这件事至今令我难以置信，但确实如此发生了。

这个案例最大的启示并非"努力就能挽回"，而是：当你失去信任时，空口承诺毫无价值。唯一的方法，就是用持续的、可见的行动逐步修复信任。即使结果不在你的控制范围内，只要你能证明"该做的都做了"，对方就无法继续责怪你。这不是什么高深的技巧，而是一种真诚的努力。

职场新人常常遇到此类问题，却很少有人告诉他们具体应对方法。试错成本极高，有时一次失误就能毁掉重要的合作关系。因此我将小语的经验分享出来，希望能帮助更多人少走弯路。毕竟，修复信任的方法不是解释，而是让对方亲眼看到你的努力。`;

async function testLightRewrite() {
  console.log('🧪 轻度改写 - 内容真实性检测');
  console.log('测试时间:', new Date().toLocaleString('zh-CN'));
  console.log('\n原文关键信息：');
  console.log('  - 每天给移民局打电话');
  console.log('  - 打了整整一个月');
  console.log('  - 周末晚上八九点');
  console.log('  - 晚上10点多');
  console.log('  - 持续30天');
  console.log('  - 连续三年');
  console.log('  - 一大箱猕猴桃');
  console.log('\n⚠️  原文中不存在的信息（禁止出现）：');
  console.log('  - 具体通话次数（如"每天7通"）');
  console.log('  - 具体通话细节（如"机械女声""差点摔手机"）');
  console.log('  - 观点性总结（如"我见过太多人栽在XX上"）');
  console.log('  - 心理活动细节（如"叹气""犹豫""纠结"）');
  console.log('\n════════════════════════════════════════════════════════════════════════════════\n');

  const response = await fetch('http://localhost:8787/api/universal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: testArticle,
      strength: '轻度',
      structure: '结论先行',
      style: '真实案例风格'
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ 改写完成\n');

  // 处理不同的响应格式
  const rewriteResult = data.result || data.output || data.text || JSON.stringify(data);

  console.log('📝 改写结果：');
  console.log('────────────────────────────────────────────────────────────────────────────────');
  console.log(rewriteResult);
  console.log('────────────────────────────────────────────────────────────────────────────────\n');

  // 检测是否存在编造内容
  const fabricatedPatterns = [
    { pattern: /每天\s*\d+\s*通/i, desc: '具体通话次数（如"每天7通"）' },
    { pattern: /第\s*\d+\s*天.*?(机械|女声|男声|录音|语音)/i, desc: '具体通话细节（如"第11天遇到机械女声"）' },
    { pattern: /(差点|险些|几乎).{0,5}(摔|砸|扔).{0,5}手机/i, desc: '心理/行为细节（如"差点摔手机"）' },
    { pattern: /我见过(太多|很多|不少)人.*?(栽在|失败在|输在)/i, desc: '观点性总结（如"我见过太多人栽在XX上"）' },
    { pattern: /(叹气|犹豫|纠结|焦虑|无奈|沮丧|愤怒)/i, desc: '未提及的心理活动' }
  ];

  console.log('🔍 内容真实性检查：');
  let hasFabrication = false;

  fabricatedPatterns.forEach(({ pattern, desc }) => {
    const match = rewriteResult.match(pattern);
    if (match) {
      console.log(`  ❌ 发现编造内容: ${desc}`);
      console.log(`     匹配文本: "${match[0]}"`);
      hasFabrication = true;
    }
  });

  if (!hasFabrication) {
    console.log('  ✅ 未发现明显编造内容');
  }

  // 检查关键事实是否保留
  console.log('\n✅ 关键事实保留检查：');
  const keyFacts = [
    { keyword: '小语', desc: '人名' },
    { keyword: '留学', desc: '业务类型' },
    { keyword: '签证', desc: '关键事件' },
    { keyword: /(一个月|30天)/, desc: '时间信息', isRegex: true },
    { keyword: '移民局', desc: '机构名' },
    { keyword: '猕猴桃', desc: '具体物品' },
    { keyword: '三年', desc: '时长信息' },
    { keyword: /(周末.*?八九点|晚上.*?八九点)/, desc: '具体时间点1', isRegex: true },
    { keyword: /(晚上.*?10点|10点多)/, desc: '具体时间点2', isRegex: true }
  ];

  let preservedCount = 0;
  keyFacts.forEach(({ keyword, desc, isRegex }) => {
    const found = isRegex
      ? keyword.test(rewriteResult)
      : rewriteResult.includes(keyword);

    if (found) {
      console.log(`  ✓ ${desc}: 已保留`);
      preservedCount++;
    } else {
      console.log(`  ✗ ${desc}: 丢失`);
    }
  });

  console.log(`\n  保留率: ${preservedCount}/${keyFacts.length} (${Math.round(preservedCount/keyFacts.length*100)}%)`);

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log(hasFabrication ? '❌ 测试失败：仍存在内容编造问题' : '✅ 测试通过：未发现内容编造');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
}

testLightRewrite().catch(err => {
  console.error('❌ 测试失败:', err.message);
  process.exit(1);
});
