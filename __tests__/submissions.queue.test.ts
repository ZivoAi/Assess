import request from 'supertest';
import { createApp } from '../src/app';
import * as queue from '../src/worker/queue';
import { submissionsStore } from '../src/store/submissionsStore';

jest.mock('../src/worker/queue');

describe('Submissions queueing', () => {
  const app = createApp();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('enqueues grading for assignments with essay questions', async () => {
    const assignment = {
      id: 'a-essay',
      title: 'Essay test',
      questions: [{ id: 'q1', type: 'essay', prompt: 'Write about X', rubric: { modelAnswer: '...' } }]
    };

    await request(app).post('/api/assignments').send(assignment).expect(201);

    const enqueueSpy = jest.spyOn(queue, 'enqueueGradingJob').mockResolvedValue({} as any);

    const submission = { id: 's-e1', assignmentId: 'a-essay', studentId: 'stu1', answers: { q1: 'My essay' } };
    const res = await request(app).post('/api/submissions').send(submission).expect(202);

    expect(res.body.submissionId).toBe(submission.id);
    expect(enqueueSpy).toHaveBeenCalled();

    const record = submissionsStore.get(submission.id);
    expect(record).toBeDefined();
    expect(record?.status).toBe('pending');
  });
});