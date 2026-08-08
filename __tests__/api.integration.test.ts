import request from 'supertest';
import { createApp } from '../src/app';

jest.mock('../src/db/client');

import { resetMockDb } from '../src/db/__mocks__/client';

const app = createApp();

describe('API integration', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('creates assignment and grades a submission', async () => {
    const assignment = {
      id: 'a1',
      title: 'Sample',
      questions: [
        { id: 'q1', type: 'mcq', prompt: 'Pick 2', options: ['a', 'b', 'c'], correctOptionIndex: 2 },
        { id: 'q2', type: 'short', prompt: 'Capital of France?', rubric: { modelAnswer: 'Paris' } }
      ]
    };

    await request(app).post('/api/assignments').send(assignment).expect(201);

    const submission = { id: 's1', assignmentId: 'a1', studentId: 'stu1', answers: { q1: 2, q2: 'Paris' } };
    const res = await request(app).post('/api/submissions').send(submission).expect(200);

    expect(res.body.totalScore).toBeGreaterThanOrEqual(1);
    expect(res.body.details).toBeDefined();
  });
});
