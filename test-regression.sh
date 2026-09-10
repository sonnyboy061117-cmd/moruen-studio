#!/bin/bash
echo "🧪 回归测试 - 验证4个问题修复"
echo "测试时间: $(date)"
echo ""

TEST_ARTICLE='如何成功挽回失去信任的资源方

信任这东西，碎了再粘，裂缝还在。但有些人偏偏能把裂缝磨平，甚至让关系变得比从前更牢固。

我认识的小语就做到了这一点。她的留学业务主要靠一个资源方介绍客户，合作一直很顺利，直到那次签证事件彻底搞砸了。

事情的起因其实挺常见：一个学生的签证递交了好几个月都没消息，家长急了，周末晚上八九点开始轰炸资源方。偏偏资源方那天发着高烧，扛着巨大的压力想找小语团队商量对策，结果消息发出去石沉大海——小语直到晚上10点多才看到，那会儿资源方已经把电话拉黑了。

换成很多人，这种情况可能就放弃了。毕竟签证审批是移民局的事，催也催不动，还不如等着时间冲淡矛盾。

但小语选择了一条最笨也最管用的路：每天给移民局打电话，打了整整一个月。

重点不在于催签本身有没有用，而在于她做到了"让对方看见"。每一通电话打完，不管移民局的回复是不是和昨天一模一样，她都会把通话截图和结果实时发给资源方。30天，没有一天间断。

最后签证是下来了，但学生已经错过了那个学期的入学时间，只能延期到下一年。按理说这个结果并不完美，可资源方不仅没有继续追究，反而主动给小语道歉，还连续三年每到八九月份就寄一大箱猕猴桃过来。

这件事给我最大的启发是：当你已经失去信任的时候，空口承诺没有任何意义，唯一能做的就是用持续的、可见的行动把信任一点点补回来。哪怕结果不在你的控制范围内，但只要你能证明"该做的我都做了"，对方就没办法再怪你。

新人在职场上常常会遇到这类问题，却很少有人告诉他们具体该怎么办。试错的代价太高，有时候一次失误就能毁掉一个重要的合作关系。所以我把小语的经验分享出来，希望能帮到更多人少走弯路。'

test_strength() {
  local strength=$1
  local label=$2
  echo "============================================================"
  echo "测试 ${label} (${strength})"
  echo "============================================================"
  
  result=$(curl -s http://localhost:8787/api/universal -X POST -H "Content-Type: application/json" -d "{\"text\":\"$TEST_ARTICLE\",\"strength\":\"$strength\",\"structure\":\"结论先行\",\"style\":\"真实案例风格\"}")
  
  if [ -z "$result" ]; then
    echo "❌ 请求失败：无响应"
    return 1
  fi
  
  # 检查关键词
  if echo "$result" | grep -q "留学" && echo "$result" | grep -q "资源方" && echo "$result" | grep -q "小语" && echo "$result" | grep -q "移民局"; then
    echo "✓ 关键词保留: 正常"
  else
    echo "✓ 关键词保留: ❌ 异常"
    return 1
  fi
  
  # 检查无编造细节
  if echo "$result" | grep -qE "四个月|三个月|五个月|39度|三十九度|10[:：点][0-9]{2}"; then
    echo "✓ 无编造细节: ❌ 异常（发现编造）"
    return 1
  else
    echo "✓ 无编造细节: 正常"
  fi
  
  # 提取字数和分数
  length=$(echo "$result" | grep -o '"text":"[^"]*"' | sed 's/"text":"//;s/"$//' | wc -c)
  score=$(echo "$result" | grep -o '"score":[0-9]*' | grep -o '[0-9]*')
  
  echo "✓ 返回结果长度: ${length} 字"
  echo "✓ AI味分数: ${score}%"
  echo ""
  return 0
}

# 测试三档改写
medium_result=0
deep_result=0
complete_result=0
deai_result=0

test_strength "中度" "中度改写" && medium_result=1
sleep 2
test_strength "深度" "深度改写" && deep_result=1
sleep 2
test_strength "完全重写" "完全重写" && complete_result=1
sleep 2

# 测试仅降AI
echo "============================================================"
echo "测试 仅降AI味"
echo "============================================================"
result=$(curl -s http://localhost:8787/api/universal -X POST -H "Content-Type: application/json" -d "{\"text\":\"$TEST_ARTICLE\",\"onlyDeAI\":true}")
if [ -n "$result" ]; then
  echo "✓ 功能正常: 是"
  deai_result=1
else
  echo "❌ 功能异常"
fi
echo ""

# 汇总结果
echo "============================================================"
echo "📊 回归测试结果"
echo "============================================================"
[ $medium_result -eq 1 ] && echo "中度改写: ✅ 通过" || echo "中度改写: ❌ 失败"
[ $deep_result -eq 1 ] && echo "深度改写: ✅ 通过" || echo "深度改写: ❌ 失败"
[ $complete_result -eq 1 ] && echo "完全重写: ✅ 通过" || echo "完全重写: ❌ 失败"
[ $deai_result -eq 1 ] && echo "仅降AI味: ✅ 通过" || echo "仅降AI味: ❌ 失败"

total=$((medium_result + deep_result + complete_result + deai_result))
if [ $total -eq 4 ]; then
  echo ""
  echo "总结: ✅ 所有测试通过"
  exit 0
else
  echo ""
  echo "总结: ❌ 部分测试失败 ($total/4)"
  exit 1
fi
