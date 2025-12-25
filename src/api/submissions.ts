import express from 'express';
import { Submission } from '../types';
import { assignments } from './assignments';
import { runGradingPipeline } from '../grader/core';
import { registry } from '../grader/registry';
import { submissionsStore } from '../store/submissionsStore';
import { enqueueGradingJob } from '../worker/queue';

const router = express.Router();

// POST a submission. If the assignment contains heavy question types (essay/code)
// we enqueue a job and return 202 Accepted with a result URL. Otherwise grade synchronously.
router.post('/', async (req, res) => {
  const s: Submission = req.body;
  const assignment = assignments.get(s.assignmentId);
  if (!assignment) return res.status(404).send('Assignment not found');

  const hasHeavy = assignment.questions.some((q) => q.type === 'essay' || q.type === 'code');

  if (hasHeavy) {
    // Create pending entry and enqueue
    submissionsStore.createPending(s.id);
    await enqueueGradingJob(s);
    return res.status(202).json({ submissionId: s.id, status: 'queued', resultUrl: `/api/submissions/${s.id}/result` });
  }

  const result = await runGradingPipeline(assignment.questions, s.answers || {}, registry, s.id);
  submissionsStore.setResult(s.id, result);
  res.json(result);
});

// GET grading result/status
router.get('/:id/result', (req, res) => {
  const r = submissionsStore.get(req.params.id);
  if (!r) return res.status(404).send('No record');
  res.json(r);
});

export { router as submissionsRouter };
