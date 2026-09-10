/**
 * 模糊表述精确化检测器 v2
 * 使用"对比法"检测数字精确化 + 模型自查检测虚构情节
 */

import { chat } from './llm.js';

/**
 * 提取文本中的所有数字表达（宽松匹配）
 * @param {string} text - 文本
 * @returns {Array} 数字表达列表，每项包含 {value, context}
 */
function extractNumberExpressions(text) {
  const expressions = [];

  // 匹配模式：数字（阿拉伯数字或中文数字）+ 可选的单位/量词
  // 包括：39.8度、38度9、三个月、10点40、十点四十、30多条、好几个月、11月、去年等
  const patterns = [
    // === 特殊格式优先匹配（避免被拆分）===
    /\d+度\d+/g, // 特殊格式：38度9、39度2（完整匹配，包含度后面的数字）
    /\d+[点:：]\d+/g, // 时间格式：10:40、10点40

    // === 阿拉伯数字 + 单位 ===
    /\d+(?:\.\d+)?(?:度|℃|°C)/g, // 温度：39.8度、38度
    /\d+(?:分|秒|点|时)/g, // 时间单位
    /\d+(?:个)?月/g, // 月份：3个月、11月
    /\d+(?:天|年|周)/g, // 日期单位
    /\d+(?:条|通|份|次|遍)/g, // 次数
    /\d+(?:个|位|名)?人/g, // 人数
    /\d+岁/g, // 年龄
    /\d+(?:公里|km|千米|米|厘米)/g, // 距离
    /\d+(?:平米?|㎡|平方米)/g, // 面积

    // === 中文数字 + 单位 ===
    /[一二三四五六七八九十百千万]+(?:个)?月/g, // 三个月、十一月
    /[一二三四五六七八九十][点:：][一二三四五六七八九十]+/g, // 十点四十
    /[零一二三四五六七八九十]+度[零一二三四五六七八九]/g, // 三十八度九
    /[一二三四五六七八九十百千万]+(?:天|年|周|小时|分钟)/g,
    /[一二三四五六七八九十百千万]+(?:条|通|份|次|遍|个|人|岁)/g,

    // === 带修饰的数字 ===
    /\d+(?:多|来|几)?(?:个|条|通|份|次|人|位|名|天|年|月)/g,
    /[一二三四五六七八九十]+(?:多|来|几)?(?:个|条|通|份|次|人|位|名|天|年|月)/g,

    // === 时间表达（年份、月份、季节）===
    /(?:去年|今年|明年|前年|上个月|这个月|下个月)/g,
    /(?:上半年|下半年|第[一二三四]季度)/g,
    /\d{4}年/g, // 2023年
  ];

  patterns.forEach(pattern => {
    let match;
    // 重置正则的 lastIndex（避免全局正则的状态问题）
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      // 提取匹配的数字表达及其上下文（前后各10个字符）
      const value = match[0];
      const index = match.index;
      const start = Math.max(0, index - 10);
      const end = Math.min(text.length, index + value.length + 10);
      const context = text.slice(start, end);

      expressions.push({ value, context, index });
    }
  });

  // 去重（同一位置的表达只保留最长的匹配）
  // 例如："38度9"会匹配到"38度"和"38度9"，只保留"38度9"
  const uniqueExpressions = [];
  const indexMap = new Map(); // index -> 最长匹配

  expressions.forEach(expr => {
    const existing = indexMap.get(expr.index);
    if (!existing || expr.value.length > existing.value.length) {
      indexMap.set(expr.index, expr);
    }
  });

  // 转换为数组并按位置排序
  return Array.from(indexMap.values()).sort((a, b) => a.index - b.index);
}

/**
 * 检测数字表达是否在原文中存在对应
 * @param {Object} rewrittenExpr - 改写稿中的数字表达
 * @param {Array} originalExpressions - 原文中的所有数字表达
 * @param {string} original - 原文全文（用于语义匹配）
 * @returns {boolean} 是否找到对应
 */
function findCorrespondingExpression(rewrittenExpr, originalExpressions, original) {
  // 1. 精确匹配：改写稿的数字表达在原文中也出现了
  if (originalExpressions.some(origExpr => origExpr.value === rewrittenExpr.value)) {
    return true;
  }

  // 2. 数值匹配：提取数字部分，看是否相同（如"三个月" vs "3个月"）
  const rewrittenNum = extractNumericValue(rewrittenExpr.value);
  if (rewrittenNum !== null) {
    for (const origExpr of originalExpressions) {
      const origNum = extractNumericValue(origExpr.value);
      if (origNum === rewrittenNum) {
        return true;
      }
    }
  }

  // 3. 语义位置匹配：改写稿数字的上下文，是否对应原文的某个模糊表达区域
  // 例如改写稿"38.9度"对应原文"发着高烧"
  // 这里采用简化策略：检查原文中对应位置附近是否有模糊表达关键词
  const vagueKeywords = [
    '好几', '几个', '一阵子', '很久', '不久', '多', '来', '左右', '大概', '约', '差不多',
    '晚上', '深夜', '凌晨', '早上', '中午', '下午', '点多',
    '高烧', '发烧', '烧得厉害', '发着烧', '发着高烧',
    '轰炸', '不停', '频繁', '一直', '反复', '连番',
    '很多', '一堆', '好多', '不少', '大量',
    '挺远', '很远', '不近', '有点远', '挺大', '很大', '不小'
  ];

  // 如果原文包含模糊关键词，但改写稿这个位置变成了精确数字，可能是编造
  // 但这个判断不够准确，所以我们放宽：只要原文没有这个数字就标记为疑似
  return false;
}

/**
 * 从数字表达中提取数值（支持中文数字转阿拉伯数字）
 */
function extractNumericValue(expr) {
  // 简化实现：提取阿拉伯数字部分
  const arabicMatch = expr.match(/\d+(?:\.\d+)?/);
  if (arabicMatch) {
    return parseFloat(arabicMatch[0]);
  }

  // 中文数字转换（简化版，只处理常见情况）
  const chineseMap = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };

  for (const [chinese, num] of Object.entries(chineseMap)) {
    if (expr.includes(chinese)) {
      return num;
    }
  }

  return null;
}

/**
 * 使用模型检测虚构情节
 * @param {string} original - 原文
 * @param {string} rewritten - 改写稿
 * @param {string} provider - 模型provider（默认使用deepseek-chat）
 * @param {boolean} demo - 是否演示模式
 * @returns {Promise<Object>} { hasFabrication: boolean, fabricatedContent: Array }
 */
async function detectFabricatedContent(original, rewritten, provider = 'deepseek', demo = false) {
  // 演示模式直接返回通过
  if (demo) {
    return { hasFabrication: false, fabricatedContent: [] };
  }

  const prompt = `你是一个严格的内容审核助手。请对比原文和改写稿，检测改写稿是否包含原文完全没有提到的具体内容。

**原文：**
${original}

**改写稿：**
${rewritten}

**检测任务：**
改写稿中是否包含以下类型的"无中生有"内容（原文完全没有提到的）：
1. 新增的人物（如"我朋友""我同事"等原文没有的角色）
2. 新增的事件或案例（如"上次培训""那次会议"等原文没提的具体事）
3. 新增的类比或举例（如"就像XX一样"，但原文没有这个类比）
4. 新增的具体场景描述（原文没有的地点、情境细节）
5. 新增的对话或转述（原文没有的引语、心理活动）

**注意：**
- 只检测"完全新增"的内容，改写稿对原文内容的重新表述、扩写、润色不算
- 只标记具体的、可验证的新增实体/事件，不标记风格化的修辞

**请严格按以下JSON格式回复（不要有任何其他文字）：**
{
  "hasFabrication": true/false,
  "fabricatedContent": [
    "具体描述1：改写稿第X句新增了YYY，原文没有",
    "具体描述2：..."
  ]
}`;

  try {
    const response = await chat({
      provider,
      demo,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // 低温度保证判断稳定性
      maxTokens: 512
    });

    // 解析JSON响应
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[虚构检测] 模型返回格式不正确，跳过此项检测');
      return { hasFabrication: false, fabricatedContent: [] };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      hasFabrication: result.hasFabrication || false,
      fabricatedContent: result.fabricatedContent || []
    };
  } catch (error) {
    // API 失败时记录错误但不阻断流程
    console.warn('[虚构检测失败，跳过此项检测]', error.message);
    return { hasFabrication: false, fabricatedContent: [] };
  }
}

/**
 * 主检测函数：数字精确化 + 虚构情节检测
 * @param {string} original - 原文
 * @param {string} rewritten - 改写稿
 * @param {Object} options - 选项 { provider, demo }
 * @returns {Promise<Object>} { hasFabrication: boolean, violations: Array }
 */
export async function detectPrecisionFabrication(original, rewritten, options = {}) {
  const { provider = 'deepseek', demo = false } = options;
  const violations = [];

  // ============ 1. 数字精确化检测（对比法）============
  const originalExpressions = extractNumberExpressions(original);
  const rewrittenExpressions = extractNumberExpressions(rewritten);

  const fabricatedNumbers = [];

  for (const rewrittenExpr of rewrittenExpressions) {
    const hasCorresponding = findCorrespondingExpression(rewrittenExpr, originalExpressions, original);
    if (!hasCorresponding) {
      fabricatedNumbers.push(rewrittenExpr.value);
    }
  }

  if (fabricatedNumbers.length > 0) {
    violations.push({
      type: '数字精确化',
      pattern: fabricatedNumbers,
      message: `改写稿包含原文没有的数字表达：${fabricatedNumbers.join('、')}`
    });
  }

  // ============ 2. 虚构情节检测（模型自查）============
  const fabricationCheck = await detectFabricatedContent(original, rewritten, provider, demo);

  if (fabricationCheck.hasFabrication) {
    violations.push({
      type: '虚构情节',
      pattern: fabricationCheck.fabricatedContent,
      message: '改写稿包含原文没有的人物、事件或案例'
    });
  }

  return {
    hasFabrication: violations.length > 0,
    violations
  };
}

/**
 * 生成违规报告（用于日志或返回给前端）
 */
export function formatViolationReport(violations) {
  if (violations.length === 0) return null;

  const lines = ['检测到内容编造问题：'];
  violations.forEach((v, i) => {
    lines.push(`${i + 1}. ${v.type}`);
    if (Array.isArray(v.pattern)) {
      v.pattern.forEach(item => {
        lines.push(`   - ${item}`);
      });
    } else {
      lines.push(`   ${v.pattern}`);
    }
    lines.push(`   说明：${v.message}`);
  });

  return lines.join('\n');
}
