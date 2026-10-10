import { Grader, GradeDetail } from '../types.js';

// WARNING: Code grading requires secure sandboxing; this is only an interface stub.
export class CodeGrader implements Grader {
  async grade(question: any, answer: any): Promise<GradeDetail> {
    return {
      questionId: question.id,
      correct: false,
      score: 0,
      maxScore: 1,
      feedback: 'Code grading not implemented in this environment. Use a sandbox (Docker) or an external runner.'
    };
  }
}
