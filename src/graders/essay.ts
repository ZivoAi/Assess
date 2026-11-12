import { Grader, GradeDetail } from '../types.js';
import { gradeEssayWithCore } from '../llm/openai.js';

export class EssayGrader implements Grader {
  async grade(question: any, answer: any): Promise<GradeDetail> {
    const text = String(answer ?? '');
    if (!text.trim()) return {
      questionId: question.id, correct: false, score: 0, maxScore: 1,
      feedback: 'No answer provided.', requiresTeacherReview: true,
    };
    const result = await gradeEssayWithCore(JSON.stringify({
      question: question.prompt, rubric: question.rubric ?? {}, studentAnswer: text,
    }));
    return {
      questionId: question.id, correct: result.score >= 0.6,
      score: result.score, maxScore: 1, feedback: result.feedback, requiresTeacherReview: true,
    };
  }
}
