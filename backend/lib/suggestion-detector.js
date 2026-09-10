// 建议段检测器
// 用于检测改写结果中是否包含隐性建议段落

/**
 * 检测文本结尾是否包含建议段
 * @param {string} text - 要检测的文本
 * @returns {Object} { hasSuggestion: boolean, matchedPatterns: string[], detectedSentences: string[] }
 */
export function detectSuggestionEnding(text) {
  if (!text || text.length < 50) {
    return { hasSuggestion: false, matchedPatterns: [], detectedSentences: [] };
  }

  // 分段（按换行分割）
  const paragraphs = text.split('\n').filter(p => p.trim()).map(p => p.trim());
  if (paragraphs.length === 0) {
    return { hasSuggestion: false, matchedPatterns: [], detectedSentences: [] };
  }

  // 提取最后1-2段
  const lastParagraphs = paragraphs.slice(-2);
  const lastText = lastParagraphs.join('\n');

  // 指导性关键词模式
  const guidancePatterns = [
    { pattern: /应该|最好|建议|需要|务必|必须|一定要|要|办法是|方法是/g, name: '指导性词汇' },
    { pattern: /比[^。]{0,20}更[^。]{0,20}|预防[^。]{0,20}比[^。]{0,20}更/g, name: '对比性指导' },
    { pattern: /如何|怎么|可以通过|通过.*来|采取.*措施/g, name: '方法论表达' },
    { pattern: /记住|切记|注意|关键是|重要的是/g, name: '提醒性表达' },
    { pattern: /避免|防止|不要.*|别.*|禁止/g, name: '警示性表达' }
  ];

  const matchedPatterns = [];
  const detectedSentences = [];

  // 按句子分割（按。！？分割）
  const sentences = lastText.split(/[。！？]/).filter(s => s.trim());

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length < 10) continue; // 跳过太短的句子

    for (const { pattern, name } of guidancePatterns) {
      const matches = trimmedSentence.match(pattern);
      if (matches && matches.length > 0) {
        // 排除特定情况：如果句子明显是在复述具体情节（包含人名、具体数字等）
        const hasSpecificDetails = /小[a-z语]+|[0-9]+天|[0-9]+个月|移民局|offer|材料|申请/.test(trimmedSentence);

        if (!hasSpecificDetails) {
          matchedPatterns.push(name);
          detectedSentences.push(trimmedSentence);
          break; // 一个句子只记录一次
        }
      }
    }
  }

  const hasSuggestion = matchedPatterns.length > 0;

  return {
    hasSuggestion,
    matchedPatterns: [...new Set(matchedPatterns)], // 去重
    detectedSentences
  };
}

/**
 * 生成强化的反建议段Prompt片段
 * @returns {string}
 */
export function getAntiSuggestionPrompt() {
  return `
⚠️ **结尾段落强制约束**：
- 绝对禁止：结尾不得出现"应该""最好""建议""需要""务必""一定要"等任何指导性词汇
- 绝对禁止：结尾不得使用"比...更..."、"预防...比事后...更..."这类对比性指导句式
- 绝对禁止：结尾不得总结方法论、不得给出行动建议、不得提炼经验教训
- 必须做到：结尾只能停留在对事实的陈述、对情感的描述、或开放式思考问题
- 合格示例："这件事让你想到了什么？""信任一旦崩塌，修复起来有多难？"
- 不合格示例："预防信任危机比事后修复更容易""最好的办法是提前沟通"
`;
}
