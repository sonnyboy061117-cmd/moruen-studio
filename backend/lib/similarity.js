// 墨韵工坊 · 文本相似度检测工具

/**
 * 计算两个文本的结构相似度
 * @param {string} original - 原文
 * @param {string} rewritten - 改写文本
 * @returns {object} 相似度报告
 */
export function checkSimilarity(original, rewritten) {
  const report = {
    overallScore: 0,
    structureScore: 0,
    sentenceScore: 0,
    vocabScore: 0,
    warnings: [],
    passed: true
  };

  // 1. 结构相似度检测
  const origStructure = analyzeStructure(original);
  const rewriteStructure = analyzeStructure(rewritten);
  report.structureScore = compareStructure(origStructure, rewriteStructure);

  // 2. 句式相似度检测
  report.sentenceScore = compareSentencePatterns(original, rewritten);

  // 3. 词汇重复度检测
  report.vocabScore = compareVocabulary(original, rewritten);

  // 4. 计算综合得分 (分数越高越相似，越低越好)
  report.overallScore = Math.round(
    report.structureScore * 0.4 +
    report.sentenceScore * 0.3 +
    report.vocabScore * 0.3
  );

  // 5. 生成警告
  if (report.structureScore > 70) {
    report.warnings.push(`结构相似度过高(${report.structureScore}%)，段落顺序和开头方式过于接近原文`);
  }
  if (report.sentenceScore > 60) {
    report.warnings.push(`句式相似度过高(${report.sentenceScore}%)，句子长度和标点模式过于相似`);
  }
  if (report.vocabScore > 65) {
    report.warnings.push(`词汇重复度过高(${report.vocabScore}%)，用词替换不够充分`);
  }

  // 6. 判断是否通过
  report.passed = report.overallScore < 55; // 相似度阈值55%

  return report;
}

/**
 * 分析文本结构
 */
function analyzeStructure(text) {
  const paragraphs = text.trim().split(/\n\n+/).filter(p => p.trim().length > 0);

  return {
    paragraphCount: paragraphs.length,
    firstParagraphLength: paragraphs[0]?.length || 0,
    lastParagraphLength: paragraphs[paragraphs.length - 1]?.length || 0,
    avgParagraphLength: paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length,
    startsWithQuestion: /^[^。！？\n]{5,30}[？?]/.test(text),
    startsWithStory: /^(那天|有一次|记得|去年|上周|前几天|最近)/.test(text),
    startsWithConclusion: /^(其实|说白了|简单说|核心是|关键在于)/.test(text),
    endsWithAction: /(建议|试试|可以|不妨|记住)[^。]*。\s*$/.test(text)
  };
}

/**
 * 比较结构相似度
 */
function compareStructure(orig, rewrite) {
  let score = 0;
  let checks = 0;

  // 段落数量相似度
  const paraCountDiff = Math.abs(orig.paragraphCount - rewrite.paragraphCount);
  if (paraCountDiff === 0) score += 25;
  else if (paraCountDiff === 1) score += 15;
  checks += 25;

  // 开头方式相似度
  if (orig.startsWithQuestion === rewrite.startsWithQuestion) score += 20;
  if (orig.startsWithStory === rewrite.startsWithStory) score += 20;
  if (orig.startsWithConclusion === rewrite.startsWithConclusion) score += 20;
  checks += 20;

  // 结尾方式相似度
  if (orig.endsWithAction === rewrite.endsWithAction) score += 15;
  checks += 15;

  // 首段长度相似度
  const firstParaDiff = Math.abs(orig.firstParagraphLength - rewrite.firstParagraphLength);
  if (firstParaDiff < 50) score += 20;
  else if (firstParaDiff < 100) score += 10;
  checks += 20;

  // 平均段落长度相似度
  const avgDiff = Math.abs(orig.avgParagraphLength - rewrite.avgParagraphLength);
  if (avgDiff < 30) score += 20;
  else if (avgDiff < 60) score += 10;
  checks += 20;

  return Math.round((score / checks) * 100);
}

/**
 * 比较句式模式
 */
function compareSentencePatterns(original, rewritten) {
  const origSentences = splitSentences(original);
  const rewriteSentences = splitSentences(rewritten);

  // 句子数量差异
  const countDiff = Math.abs(origSentences.length - rewriteSentences.length);
  let countScore = countDiff === 0 ? 30 : (countDiff <= 2 ? 15 : 0);

  // 句子长度分布
  const origLengths = origSentences.map(s => s.length);
  const rewriteLengths = rewriteSentences.map(s => s.length);

  const origAvg = average(origLengths);
  const rewriteAvg = average(rewriteLengths);
  const avgDiff = Math.abs(origAvg - rewriteAvg);
  let lengthScore = avgDiff < 5 ? 30 : (avgDiff < 10 ? 15 : 0);

  // 标点符号模式
  const origPunctPattern = getPunctuationPattern(original);
  const rewritePunctPattern = getPunctuationPattern(rewritten);
  const punctSimilarity = compareArrays(origPunctPattern, rewritePunctPattern);
  let punctScore = Math.round(punctSimilarity * 40);

  return Math.round((countScore + lengthScore + punctScore) / 100 * 100);
}

/**
 * 比较词汇重复度
 */
function compareVocabulary(original, rewritten) {
  // 提取关键词（排除停用词）
  const origWords = extractKeywords(original);
  const rewriteWords = extractKeywords(rewritten);

  // 计算词汇重叠率
  const commonWords = origWords.filter(w => rewriteWords.includes(w));
  const overlapRate = commonWords.length / origWords.length;

  // 检查连续词组重复
  const origBigrams = getBigrams(original);
  const rewriteBigrams = getBigrams(rewritten);
  const bigramOverlap = origBigrams.filter(b => rewriteBigrams.includes(b)).length / origBigrams.length;

  return Math.round((overlapRate * 0.5 + bigramOverlap * 0.5) * 100);
}

// === 辅助函数 ===

function splitSentences(text) {
  return text.split(/[。！？；;!?]/).filter(s => s.trim().length > 5);
}

function average(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function getPunctuationPattern(text) {
  const puncts = text.match(/[，。！？；：、,;:!?]/g) || [];
  return puncts.slice(0, 20); // 只取前20个标点
}

function compareArrays(arr1, arr2) {
  const minLen = Math.min(arr1.length, arr2.length);
  if (minLen === 0) return 0;

  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (arr1[i] === arr2[i]) matches++;
  }
  return matches / minLen;
}

function extractKeywords(text) {
  // 停用词列表（简化版）
  const stopwords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
    '能', '下', '对', '么', '什', '为', '这', '那', '与', '但', '并', '或',
    '等', '吗', '吧', '呢', '啊', '呀', '嘛'
  ]);

  // 移除标点和空格，提取2字以上的词
  const words = text.replace(/[^一-龥a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopwords.has(w));

  return words;
}

function getBigrams(text) {
  // 提取连续两个词的组合
  const words = extractKeywords(text);
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + words[i + 1]);
  }
  return bigrams;
}

/**
 * 格式化相似度报告为用户可读文本
 */
export function formatSimilarityReport(report) {
  let text = `【相似度检测】\n`;
  text += `综合相似度: ${report.overallScore}% ${report.overallScore < 55 ? '✓ 通过' : '✗ 过高'}\n`;
  text += `- 结构相似度: ${report.structureScore}%\n`;
  text += `- 句式相似度: ${report.sentenceScore}%\n`;
  text += `- 词汇重复度: ${report.vocabScore}%\n`;

  if (report.warnings.length > 0) {
    text += `\n⚠️ 警告:\n`;
    report.warnings.forEach(w => text += `  · ${w}\n`);
  }

  if (!report.passed) {
    text += `\n💡 建议: 改写与原文过于相似，建议重新生成`;
  }

  return text;
}
