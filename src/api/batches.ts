import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { submissionsStore } from '../store/submissionsStore';
import { enqueueGradingJob } from '../worker/queue';
import { batchStore } from '../store/batchStore';

const router = express.Router();

router.post('/', async (req, res) => {
  const { id, submissions, callbackUrl } = req.body;
  if (!Array.isArray(submissions) || submissions.length === 0) return res.status(400).send('submissions array required');

  const batchId = id || uuidv4();
  batchStore.createBatch(batchId, submissions.length, callbackUrl);

  for (const s of submissions) {
    submissionsStore.createPending(s.id);
    batchStore.addSubmission(batchId, s.id);
    // Enqueue with batchId so the worker can notify progress
    await enqueueGradingJob(s, { batchId });
  }

  res.status(202).json({ batchId, statusUrl: `/api/batches/${batchId}` });
});

router.get('/:id', (req, res) => {
  const b = batchStore.get(req.params.id);
  if (!b) return res.status(404).send('Not found');
  res.json(b);
});

export { router as batchesRouter };
