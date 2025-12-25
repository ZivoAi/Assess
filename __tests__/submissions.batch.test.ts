import request from 'supertest';
import axios from 'axios';
import { createApp } from '../src/app';
import * as queue from '../src/worker/queue';
import { batchStore } from '../src/store/batchStore';

jest.mock('../src/worker/queue');
jest.mock('axios');

describe('Batch submissions', () => {
  const app = createApp();

  beforeEach(() => {
    jest.resetAllMocks();
    (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
  });

  it('creates a batch and enqueues jobs', async () => {
    const enqueueSpy = jest.spyOn(queue, 'enqueueGradingJob').mockResolvedValue({} as any);

    const submissions = [
      { id: 's1', assignmentId: 'a1', studentId: 'stu1', answers: {} },
      { id: 's2', assignmentId: 'a1', studentId: 'stu2', answers: {} }
    ];

    const res = await request(app).post('/api/batches').send({ submissions, callbackUrl: 'http://example.com/cb' }).expect(202);
    expect(res.body.batchId).toBeDefined();
    expect(enqueueSpy).toHaveBeenCalledTimes(2);

    const b = batchStore.get(res.body.batchId);
    expect(b).toBeDefined();
    expect(b?.total).toBe(2);
    expect(Object.keys(b?.statuses || {}).length).toBe(2);
  });
});