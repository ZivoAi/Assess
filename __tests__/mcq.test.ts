import { MCQGrader } from '../src/graders/mcq';

describe('MCQGrader', () => {
  it('marks correct answers as correct', async () => {
    const grader = new MCQGrader();
    const q = { id: 'q1', correctOptionIndex: 2 };
    const r = await grader.grade(q, 2);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1);
  });

  it('marks wrong answers as incorrect', async () => {
    const grader = new MCQGrader();
    const q = { id: 'q1', correctOptionIndex: 1 };
    const r = await grader.grade(q, 0);
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
  });
});
