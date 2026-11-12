import express, { Request, Response } from 'express';
import { enqueueGradingJob } from '../worker/queue.js';
import { getAssignment, setAssignment } from '../api/assignments.js';
import { requireCoreServiceKey } from '../middleware/coreServiceAuth.js';

export const zivopalRouter = express.Router();

zivopalRouter.post('/webhook', requireCoreServiceKey, async (req: Request, res: Response) => {
  const { submissionId, assignmentId, studentId, answers, callbackUrl, questions } = req.body;

  if (!submissionId || !assignmentId) {
    return res.status(400).json({ error: 'submissionId and assignmentId are required' });
  }

  // If questions are provided inline, upsert the assignment into Postgres so the
  // worker can always find it — even across restarts and redeployments.
  if (questions && Array.isArray(questions)) {
    const existing = await getAssignment(assignmentId);
    if (!existing) {
      await setAssignment({ id: assignmentId, title: assignmentId, questions });
    }
  }

  try {
    await enqueueGradingJob(
      {
        id: submissionId,
        assignmentId,
        studentId,
        answers: answers || {},
        callbackUrl,
      },
    );
    return res.status(202).json({ submissionId, status: 'queued' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
