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
   * @param useEmbeddings try embeddings first (falls back to token overlap)
   */
  constructor(threshold = 0.6, useEmbeddings = false) {
    this.threshold = threshold;
    this.useEmbeddings = useEmbeddings;
  }

  async grade(question: any, answer: any): Promise<GradeDetail> {
    const modelAnswer: string = question.rubric?.modelAnswer || '';
    const maxScore = 1;

    // If embeddings are requested, try them and fall back gracefully
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
        };
      } catch (e) {
        // Fall through to token-based similarity
      }
    }

    const sim = simpleSimilarity(String(answer || ''), modelAnswer);
    const correct = sim >= this.threshold;

    return {
      questionId: question.id,
      correct,
      score: correct ? 1 : 0,
      maxScore,
      feedback: `Similarity: ${sim.toFixed(2)} - ${correct ? 'Pass' : 'Fail'}`,
    };
  }
}
