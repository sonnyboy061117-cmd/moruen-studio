// 测试批量改写的结构多样性和相似度检测

const testArticle = `如何成功挽回失去信任的资源方

信任这东西，碎了再粘，裂缝还在。但有些人偏偏能把裂缝磨平，甚至让关系变得比从前更牢固。

我认识的小语就做到了这一点。她的留学业务主要靠一个资源方介绍客户，合作一直很顺利，直到那次签证事件彻底搞砸了。

事情的起因其实挺常见：一个学生的签证递交了好几个月都没消息，家长急了，周末晚上八九点开始轰炸资源方。偏偏资源方那天发着高烧，扛着巨大的压力想找小语团队商量对策，结果消息发出去石沉大海——小语直到晚上10点多才看到，那会儿资源方已经把电话拉黑了。

换成很多人，这种情况可能就放弃了。毕竟签证审批是移民局的事，催也催不动，还不如等着时间冲淡矛盾。

但小语选择了一条最笨也最管用的路：每天给移民局打电话，打了整整一个月。

重点不在于催签本身有没有用，而在于她做到了"让对方看见"。每一通电话打完，不管移民局的回复是不是和昨天一模一样，她都会把通话截图和结果实时发给资源方。30天，没有一天间断。

最后签证是下来了，但学生已经错过了那个学期的入学时间，只能延期到下一年。按理说这个结果并不完美，可资源方不仅没有继续追究，反而主动给小语道歉，还连续三年每到八九月份就寄一大箱猕猴桃过来。`;

async function testBatchRewrite() {
  console.log('🧪 开始测试批量改写功能\n');

  try {
    // 测试1: 批量改写同一篇文章3次，查看结构差异
    console.log('📝 测试1: 批量改写3次（应该使用不同结构）');
    const response = await fetch('http://localhost:8787/api/batch-rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: [testArticle],
        count: 3,
        strength: '深度',
        logics: ['不同角度重写'],
        targetLength: 800,
        provider: 'relay',
        concurrency: 3,
        withAIOff: false,
        demo: true
      })
    });

    const task = await response.json();
    console.log(`✓ 任务创建成功，ID: ${task.id}\n`);

    // 轮询任务状态
    console.log('⏳ 等待任务完成...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 最多等待60秒

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      const statusRes = await fetch(`http://localhost:8787/api/tasks/${task.id}`);
      const status = await statusRes.json();

      if (status.status === 'done' || status.status === 'cancelled') {
        completed = true;
        console.log('\n✅ 任务完成！\n');

        // 显示结果
        status.items.forEach((item, idx) => {
          console.log(`\n========== 改写版本 ${idx + 1} ==========`);
          console.log(`状态: ${item.status}`);

          if (item.similarity) {
            console.log(`\n📊 相似度报告:`);
            console.log(`  综合相似度: ${item.similarity.score}% ${item.similarity.passed ? '✓ 通过' : '⚠️ 过高'}`);
            console.log(`  - 结构相似度: ${item.similarity.structure}%`);
            console.log(`  - 句式相似度: ${item.similarity.sentence}%`);
            console.log(`  - 词汇重复度: ${item.similarity.vocab}%`);

            if (item.similarity.warnings.length > 0) {
              console.log(`  ⚠️ 警告:`);
              item.similarity.warnings.forEach(w => console.log(`    - ${w}`));
            }
          }

          if (item.similarityWarning) {
            console.log(`  💡 ${item.similarityWarning}`);
          }

          if (item.body) {
            console.log(`\n📄 改写内容预览 (前200字):`);
            console.log(item.body.substring(0, 200) + '...\n');
          }

          if (item.error) {
            console.log(`  ❌ 错误: ${item.error}`);
          }
        });

        console.log('\n========================================\n');
        console.log('🎉 测试完成！请检查：');
        console.log('1. 三个版本的开头方式是否不同');
        console.log('2. 相似度是否都在合理范围内');
        console.log('3. 是否有相似度过高的警告');

      } else {
        process.stdout.write(`\r⏳ 进度: ${status.success + status.fail}/${status.total} (${attempts}s)`);
      }
    }

    if (!completed) {
      console.log('\n⏱️ 任务超时，请手动检查任务状态');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testBatchRewrite();
