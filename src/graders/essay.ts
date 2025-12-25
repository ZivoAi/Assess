import { Grader, GradeDetail } from '../types';

import { scoreEssayWithOpenAI } from '../llm/openai';

export class EssayGrader implements Grader {
  // Use OpenAI when available, otherwise fall back to keyword matching
  async grade(question: any, answer: any): Promise<GradeDetail> {
    const maxScore = 1;
    const text = String(answer || '');

    // Try LLM-based scoring
    try {
      const prompt = JSON.stringify({ modelAnswer: question.rubric?.modelAnswer || '', studentAnswer: text });
      const s = await scoreEssayWithOpenAI(prompt);
      const score = s >= 0.6 ? 1 : 0;
      return {
        questionId: question.id,
        correct: score >= 1,
        score,
        maxScore,
        feedback: `LLM score: ${s.toFixed(2)}`,
      };
    } catch (e) {
      // Fallback keyword matching
      const keywords = (question.rubric?.keywords || []).map((k: string) => k.toLowerCase());
      const found = keywords.filter((k: string) => text.toLowerCase().includes(k)).length;
      const ratio = keywords.length ? found / keywords.length : 0;
      const score = ratio >= 0.6 ? 1 : 0;

      return {
        questionId: question.id,
        correct: score >= 1,
        score,
        maxScore,
        feedback: `Keywords matched: ${found}/${keywords.length}`,
      };
    }
  }
}
