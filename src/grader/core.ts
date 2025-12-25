import { Grader, GradeDetail, Question } from '../types';

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
  const details: GradeDetail[] = [];
  let total = 0;
  let max = 0;

  for (const q of questions) {
    const grader = registry.get(q.type) as Grader;
    if (!grader) {
      details.push({ questionId: q.id, correct: false, score: 0, maxScore: 1, feedback: 'No grader for type' });
      max += 1;
      continue;
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
  };
}
