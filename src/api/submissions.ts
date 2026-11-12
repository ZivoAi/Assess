import express from 'express';
import { Submission } from '../types.js';
import { getAssignment } from './assignments.js';
import { gradeStoredTask } from '../grader/stored.js';
import { prepareGradingTask } from '../grader/task.js';
import { submissionsStore } from '../store/submissionsStore.js';
import { enqueueGradingJob } from '../worker/queue.js';

const router = express.Router();

// POST a submission. If the assignment contains heavy question types (essay/code)
// we enqueue a job and return 202 Accepted with a result URL. Otherwise grade synchronously.
router.post('/', async (req, res, next) => { try {
  const task = await prepareGradingTask(req.body);
  const s = task.submission, assignment = task.assignment;

  const hasHeavy = assignment.questions.some((q) => q.type === 'essay' || q.type === 'code');

  if (hasHeavy) {
    // Create pending entry and enqueue
    await enqueueGradingJob(s);
    return res.status(202).json({ submissionId: s.id, status: 'accepted', resultUrl: `/api/submissions/${s.id}/result` });
  }

  await submissionsStore.createPending(s.id, task.requestHash);
  const result = await gradeStoredTask(task);
  res.json(result);
} catch (error) { next(error); } });

// GET grading result/status
router.get('/:id/result', async (req, res) => {
  const r = await submissionsStore.get(req.params.id);
  if (!r) return res.status(404).send('No record');
  res.json(r);
});

export { router as submissionsRouter };
