import express, { Request, Response, NextFunction } from 'express';
  import { enqueueGradingJob } from '../worker/queue.js';
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
    const { submissionId, assignmentId, studentId, answers, callbackUrl } = req.body;

    if (!submissionId || !assignmentId) {
      return res.status(400).json({ error: 'submissionId and assignmentId are required' });
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
  