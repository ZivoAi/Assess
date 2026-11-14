import { Grader, GradeDetail } from '../types.js';
import { getEmbedding, cosineSimilarity } from '../embeddings/openai.js';

export class ShortAnswerEmbeddingGrader implements Grader {
  threshold: number;

  constructor(threshold = 0.72) {
    this.threshold = Number(process.env.SHORT_EMBEDDING_THRESHOLD ?? threshold);
    if (!Number.isFinite(this.threshold) || this.threshold < 0 || this.threshold > 1) throw new Error('Invalid grading threshold');
  }

  async grade(question: any, answer: any): Promise<GradeDetail> {
    const modelAnswer: string = question.rubric?.modelAnswer || '';
    const student = String(answer || '');

    try {
      const [a, b] = await Promise.all([getEmbedding(modelAnswer), getEmbedding(student)]);
      const sim = cosineSimilarity(a, b);
      const correct = sim >= this.threshold;
      return {
        questionId: question.id,
        correct,
        score: correct ? 1 : 0,
        maxScore: 1,
        feedback: `Embedding similarity: ${sim.toFixed(3)} - ${correct ? 'Pass' : 'Fail'}`,
        requiresTeacherReview: true,
      };
    } catch (e) {
      throw new Error('Semantic scoring unavailable; no mark confirmed. Teacher review is required.');
    }
  }
}
