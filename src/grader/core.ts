import { Grader, GradeDetail, Question } from '../types.js';

export class GraderRegistry {
  private graders: Record<string, Grader> = {};

  register(type: string, grader: Grader) {
    this.graders[type] = grader;
  }

  get(type: string): Grader | undefined {
    return this.graders[type];
  }
}

export async function runGradingPipeline(questions: Question[], answers: Record<string, any>, registry: GraderRegistry, submissionId: string) {
  if (!questions.length) throw new Error('No assessment questions; no mark confirmed. Teacher review is required.');
  const details: GradeDetail[] = [];
  let total = 0;
  let max = 0;

  for (const q of questions) {
    const grader = registry.get(q.type) as Grader;
    if (!grader) {
      throw new Error('Unsupported question type; no mark confirmed. Teacher review is required.');
    }
    const answer = answers[q.id];
    const d = await grader.grade(q, answer);
    details.push(d);
    total += d.score;
    max += d.maxScore;
  }

  return {
    submissionId,
    totalScore: total,
    details,
    requiresTeacherReview: details.some(detail => detail.requiresTeacherReview === true),
  };
}

export function canAutoPublish(result: { requiresTeacherReview?: boolean; details: GradeDetail[] }): boolean {
  return result.requiresTeacherReview !== true && !result.details.some(detail => detail.requiresTeacherReview === true);
}
