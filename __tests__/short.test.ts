import { ShortAnswerGrader } from '../src/graders/shortAnswer';

describe('ShortAnswerGrader', () => {
  it('marks similar answers as pass', async () => {
    const g = new ShortAnswerGrader(0.5);
    const q = { id: 'q1', rubric: { modelAnswer: 'Paris' } };
    const r = await g.grade(q, 'Paris');
    expect(r.correct).toBe(true);
  });

  it('marks dissimilar answers as fail', async () => {
    const g = new ShortAnswerGrader(0.8);
    const q = { id: 'q1', rubric: { modelAnswer: 'Paris' } };
    const r = await g.grade(q, 'London');
    expect(r.correct).toBe(false);
  });
});