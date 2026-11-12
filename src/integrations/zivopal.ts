import express, { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { enqueueGradingJob } from '../worker/queue.js';
import { getAssignment, setAssignment } from '../api/assignments.js';
import { requireCoreServiceKey } from '../middleware/coreServiceAuth.js';
import { canonicalJson, GradingRequestError } from '../grader/task.js';

export const zivopalRouter = express.Router();

zivopalRouter.post('/webhook', requireCoreServiceKey, async (req: Request, res: Response, next) => { try {
  const { submissionId, assignmentId, studentId, answers, callbackUrl, questions } = req.body;

  if (!submissionId || !assignmentId) {
    return res.status(400).json({ error: 'submissionId and assignmentId are required' });
  }

  // Core owns the assignment. Assess keeps immutable processing snapshots so
  // later edits cannot change an already claimed grade or block new submissions.
  let questionSourceId: string | undefined;
  if (questions && Array.isArray(questions)) {
    questionSourceId = 'source_' + createHash('sha256').update(canonicalJson([assignmentId, questions])).digest('hex');
    const existing = await getAssignment(questionSourceId);
    if (existing && canonicalJson(existing.questions) !== canonicalJson(questions)) {
      throw new GradingRequestError(409, 'ASSIGNMENT_CONFLICT', 'The stored assessment snapshot requires review');
    }
    if (!existing) {
      await setAssignment({ id: questionSourceId, title: assignmentId, questions });
    }
  }

    await enqueueGradingJob(
      {
        id: submissionId,
        assignmentId,
        studentId,
        answers: answers || {},
        callbackUrl,
      },
      undefined,
      questionSourceId,
    );
    return res.status(202).json({ submissionId, status: 'accepted' });
} catch (error) { next(error); } });
