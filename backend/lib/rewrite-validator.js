// 完全重写内容校验器
// 检测新增段落数量是否达标

/**
 * 检测改写稿中有多少段落是原文没有的新增内容
 * @param {string} originalText - 原文
 * @param {string} rewrittenText - 改写稿
 * @returns {Object} { newParagraphCount, details }
 */
export function detectNewParagraphs(originalText, rewrittenText) {
  // 分段
  const origParagraphs = originalText.trim().split('\n\n').filter(p => p.trim().length > 50);
  const rewriteParagraphs = rewrittenText.trim().split('\n\n').filter(p => p.trim().length > 50);

  // 从原文提取核心事实（不包含通用词）
  const origKeywords = extractCoreKeywords(originalText);

  // 检测每个改写段落是否为新增内容
  const newParagraphs = [];

  rewriteParagraphs.forEach((para, idx) => {
    const matchScore = calculateMatchScore(para, origParagraphs);
    const keywordOverlap = countKeywordOverlap(para, origKeywords);

    // 优化后的判断逻辑：
    // 1. 如果与原文任何段落的相似度都低于35%，且关键词重叠度低于50% → 新增内容
    // 2. 或者，相似度低于25% → 无论关键词重叠度多高都算新增（因为可能是类比案例，会使用相同主题词）
    const isNew = (matchScore < 0.35 && keywordOverlap < 0.5) || (matchScore < 0.25);

    if (isNew) {
      newParagraphs.push({
        index: idx,
        content: para.substring(0, 100) + '...',
        matchScore,
        keywordOverlap,
        length: para.length
      });
    }
  });

  return {
    newParagraphCount: newParagraphs.length,
    details: newParagraphs,
    totalParagraphs: rewriteParagraphs.length
  };
}

/**
 * 从文本中提取核心关键词（只提取强特征词，不包含通用词）
 */
function extractCoreKeywords(text) {
  const keywords = new Set();

  // 提取人名（中文姓名模式）
  const namePattern = /[张王李赵刘陈杨黄周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾萧田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹熊孟秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤][一-龥]{1,2}/g;
  const names = text.match(namePattern) || [];
  names.forEach(n => keywords.add(n));

  // 提取数字（时间、金额等）
  const numbers = text.match(/\d+[年月日天元万亿%岁]/g) || [];
  numbers.forEach(n => keywords.add(n));

  // 只提取行业特有名词（移除通用词如"客户"、"团队"、"合作"）
  const industryWords = text.match(/留学|签证|移民局|资源方/g) || [];
  industryWords.forEach(w => keywords.add(w));

  return Array.from(keywords);
}

/**
 * 计算段落与原文段落集合的最高匹配度
 */
function calculateMatchScore(paragraph, originalParagraphs) {
  let maxScore = 0;

  originalParagraphs.forEach(origPara => {
    const score = calculateSimilarity(paragraph, origPara);
    if (score > maxScore) {
      maxScore = score;
    }
  });

  return maxScore;
}

/**
 * 计算两个段落的相似度（基于字符级n-gram）
 */
function calculateSimilarity(text1, text2) {
  const ngrams1 = generateNgrams(text1, 3);
  const ngrams2 = generateNgrams(text2, 3);

  const set1 = new Set(ngrams1);
  const set2 = new Set(ngrams2);

  let intersection = 0;
  set1.forEach(gram => {
    if (set2.has(gram)) intersection++;
  });

  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * 生成n-gram
 */
function generateNgrams(text, n) {
  const grams = [];
  const cleaned = text.replace(/\s+/g, '');
  for (let i = 0; i <= cleaned.length - n; i++) {
    grams.push(cleaned.substring(i, i + n));
  }
  return grams;
}

/**
 * 计算段落与关键词列表的重叠度
 */
function countKeywordOverlap(paragraph, keywords) {
  let matchCount = 0;
  keywords.forEach(keyword => {
    if (paragraph.includes(keyword)) matchCount++;
  });
  return keywords.length > 0 ? matchCount / keywords.length : 0;
}

/**
 * 验证完全重写是否达标（至少2段新增内容）
 */
export function validateFullRewrite(originalText, rewrittenText) {
  const result = detectNewParagraphs(originalText, rewrittenText);

  return {
    passed: result.newParagraphCount >= 2,
    newParagraphCount: result.newParagraphCount,
    required: 2,
    details: result.details,
    message: result.newParagraphCount >= 2
      ? `✓ 检测到${result.newParagraphCount}段新增内容，达标`
      : `⚠ 仅检测到${result.newParagraphCount}段新增内容，未达到要求的2段`
  };
}
