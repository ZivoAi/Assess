import express, { Request, Response, NextFunction } from 'express';
import { enqueueGradingJob } from '../worker/queue.js';
import { getAssignment, setAssignment } from '../api/assignments.js';
import { ZIVOPAL_SERVICE_KEY } from '../config.js';

export const zivopalRouter = express.Router();

function validateServiceKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-service-key'];
  if (!ZIVOPAL_SERVICE_KEY) {
    return res.status(500).json({ error: 'Service key not configured on this server' });
  }
  if (!key || key !== ZIVOPAL_SERVICE_KEY) {
    return res.status(401).json({ error: 'Invalid or missing X-Service-Key' });
  }
  next();
}

zivopalRouter.post('/webhook', validateServiceKey, async (req: Request, res: Response) => {
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
