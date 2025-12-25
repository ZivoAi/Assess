import { Grader } from '../types';
import { GradeDetail } from '../types';

export class MCQGrader implements Grader {
  async grade(question: any, answer: any): Promise<GradeDetail> {
    const maxScore = 1;
    const correctIndex = question.correctOptionIndex;
    const given = answer;
    const correct = correctIndex === given;
    return {
      questionId: question.id,
      correct,
      score: correct ? 1 : 0,
      maxScore,
      feedback: correct ? 'Correct \u2714' : 'Incorrect \u2716',
    };
  }
}
