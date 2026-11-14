import { Grader, GradeDetail } from '../types.js';
import { getEmbedding, cosineSimilarity } from '../llm/embeddings.js';

function normalize(s: string) {
  return s ? s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';
}

function simpleSimilarity(a: string, b: string) {
  const na = normalize(a).split(' ').filter(Boolean);
  const nb = normalize(b).split(' ').filter(Boolean);
  if (na.length === 0 || nb.length === 0) return 0;
  const setB = new Set(nb);
  const common = na.filter((w) => setB.has(w)).length;
  return common / Math.max(na.length, nb.length);
}

export class ShortAnswerGrader implements Grader {
  threshold: number;
  useEmbeddings: boolean;

  /**
   * @param threshold similarity threshold (0-1)
   * @param useEmbeddings request semantic scoring through Core; failures require review
   */
  constructor(threshold = 0.6, useEmbeddings = false) {
    this.threshold = threshold;
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Invalid grading threshold');
    this.useEmbeddings = useEmbeddings;
  }

  async grade(question: any, answer: any): Promise<GradeDetail> {
    const modelAnswer: string = question.rubric?.modelAnswer || '';
    const maxScore = 1;

    // An explicitly requested semantic method must never silently become lexical scoring.
    if (this.useEmbeddings || question.rubric?.useEmbeddings) {
      try {
        const [ea, eb] = await Promise.all([getEmbedding(modelAnswer), getEmbedding(String(answer || ''))]);
        const sim = cosineSimilarity(ea, eb);
        const correct = sim >= this.threshold;
        return {
          questionId: question.id,
          correct,
          score: correct ? 1 : 0,
          maxScore,
          feedback: `Embedding similarity: ${sim.toFixed(3)} - ${correct ? 'Pass' : 'Fail'}`,
          requiresTeacherReview: true,
        };
      } catch (e) {
        throw new Error('Semantic scoring unavailable; no mark confirmed. Teacher review is required.');
      }
    }

    const sim = simpleSimilarity(String(answer || ''), modelAnswer);
    const correct = sim >= this.threshold;

    return {
      questionId: question.id,
      correct,
      score: correct ? 1 : 0,
      maxScore,
      feedback: `Lexical overlap estimate: ${sim.toFixed(2)}. Teacher review required.`,
      requiresTeacherReview: true,
    };
  }
}
