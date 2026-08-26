// 墨韵工坊 · 降 AI 味 4 阶段流水线(后端)
// 严格串行: 去模板 → 增口语 → 调句式 → 加温度
// 每阶段打分,不达标带反馈重做,最多 loop_max 轮
import { chat } from './llm.js';
import { scoreAI } from './scoring.js';
import { DEAI_STAGES, BASE_SYSTEM } from './prompts.js';
import { config } from './config.js';

const STAGES = ['去模板', '增口语', '调句式', '加温度'];

export async function runDeAI({ text, provider, maxLoops, onStageStart, onLoopResult, demo = false }) {
  const cfg = config.scoring;
  const loops = maxLoops ?? cfg.loop_max;
  let current = text;
  const trace = [];

  for (const stage of STAGES) {
    if (onStageStart) onStageStart(stage);
    let bestResult = current;
    let bestScore = scoreAI(current).score;

    for (let loop = 0; loop <= loops; loop++) {
      const prompt = DEAI_STAGES[stage].replace('{TEXT}', current);
      try {
        const out = await chat({
          provider,
          demo,
          system: BASE_SYSTEM,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.85,
          maxTokens: Math.max(1024, Math.floor(text.length * 1.5))
        });
        const cleaned = out.trim();
        if (!cleaned) break;
        const sc = scoreAI(cleaned);
        trace.push({ stage, loop, score: sc.score, level: sc.level });

        if (sc.score < bestScore || loop === 0) {
          bestResult = cleaned;
          bestScore = sc.score;
        }
        if (onLoopResult) onLoopResult({ stage, loop, score: sc.score, level: sc.level });

        if (sc.score < cfg.pass_threshold || loop === loops) {
          current = bestResult;
          break;
        }
        current = cleaned;
      } catch (e) {
        if (onLoopResult) onLoopResult({ stage, loop, error: e.message });
        break;
      }
    }
  }

  const finalScore = scoreAI(current);
  return { text: current, score: finalScore.score, level: finalScore.level, trace, passed: finalScore.passed };
}
