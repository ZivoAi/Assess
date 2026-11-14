import { Grader, GradeDetail } from '../types.js';

// No insecure local execution and no fabricated zero for an unavailable grader.
export class CodeGrader implements Grader {
  async grade(_question: any, _answer: any): Promise<GradeDetail> {
    throw new Error('Code grading is unavailable; no mark confirmed. Teacher review is required.');
  }
}
