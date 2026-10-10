import { Grader, GradeDetail } from '../types.js';
import { getEmbedding, cosineSimilarity } from '../embeddings/openai.js';
import { ShortAnswerGrader } from './shortAnswer.js';

export class ShortAnswerEmbeddingGrader implements Grader {
  threshold: number;
  fallback: ShortAnswerGrader;

  constructor(threshold = 0.72) {
    this.threshold = Number(process.env.SHORT_EMBEDDING_THRESHOLD ?? threshold);
    this.fallback = new ShortAnswerGrader(0.6);
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
      };
    } catch (e) {
      // Fallback to simple token overlap
      return this.fallback.grade(question, answer);
    }
  }
}
