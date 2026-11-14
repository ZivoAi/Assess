import express from 'express';
import { createHash } from 'node:crypto';
import { prepareGradingTask, GradingRequestError } from '../grader/task.js';
import { enqueueGradingJob } from '../worker/queue.js';
import { batchStore } from '../store/batchStore.js';

const router = express.Router();

router.post('/', async (req, res, next) => { try {
  const { id, submissions, callbackUrl } = req.body;
  if (!Array.isArray(submissions) || submissions.length === 0) return res.status(400).send('submissions array required');
  if (submissions.length > 100 || new Set(submissions.map(s => s?.id)).size !== submissions.length || callbackUrl !== undefined) {
    throw new GradingRequestError(400, 'INVALID_BATCH', 'Use 1–100 unique submissions and poll protected status; progress callbacks are not configured');
  }
  const tasks = await Promise.all(submissions.map(submission => prepareGradingTask(submission)));

  const batchId = id || createHash('sha256').update(JSON.stringify(tasks.map(task => [task.submission.id, task.requestHash]).sort())).digest('hex');
  if (typeof batchId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(batchId)) {
    throw new GradingRequestError(400, 'INVALID_BATCH', 'A stable batch ID is required');
  }
  const batch = await batchStore.createBatch(batchId, submissions.length);
  if (Object.keys(batch.statuses).some(key => !submissions.some(s => s.id === key))) {
    throw new GradingRequestError(409, 'BATCH_CONFLICT', 'This batch ID belongs to different submissions');
  }

  for (const s of submissions) {
    await batchStore.addSubmission(batchId, s.id);
    // Enqueue with batchId so the worker can notify progress
    await enqueueGradingJob(s, { batchId });
  }

  res.status(202).json({ batchId, status: 'accepted', statusUrl: `/api/batches/${batchId}` });
} catch (error) { next(error); } });

router.get('/:id', async (req, res) => {
  const b = await batchStore.get(req.params.id);
  if (!b) return res.status(404).send('Not found');
  res.json(b);
});

export { router as batchesRouter };
