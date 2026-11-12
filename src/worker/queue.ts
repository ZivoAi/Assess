import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { canAutoPublish } from '../grader/core.js';
import { gradeStoredTask } from '../grader/stored.js';
import { prepareGradingTask, GradingRequestError, GradingTask } from '../grader/task.js';
import { submissionsStore } from '../store/submissionsStore.js';
import { batchStore } from '../store/batchStore.js';
import { REDIS_URL } from '../config.js';
import { coreGradeCallbackUrl, postGradeCallback } from '../integrations/gradeCallback.js';
import type { GradeResult } from '../types.js';

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const gradingQueue = new Queue('grading', { connection });

export async function enqueueGradingJob(submission: any, opts?: { batchId?: string }, questionSourceId?: string) {
  const task = await prepareGradingTask(submission, questionSourceId);
  await submissionsStore.createPending(task.submission.id, task.requestHash);
  const { createHash } = await import('node:crypto');
  const jobId = createHash('sha256').update(task.submission.id).digest('hex');
  const prior = await gradingQueue.getJob(jobId);
  if (prior) {
    if (prior.data.task?.requestHash !== task.requestHash || prior.data.batchId !== opts?.batchId) {
      throw new GradingRequestError(409, 'SUBMISSION_CONFLICT', 'This job belongs to different grading data');
    }
    if (await prior.getState() === 'failed') {
      const saved = await submissionsStore.get(task.submission.id);
      if (saved?.status !== 'pending' && !(saved?.status === 'completed' && saved.result)) {
        throw new GradingRequestError(409, 'GRADING_REVIEW_REQUIRED', 'A started or failed grading request requires manual review');
      }
      await prior.retry(); // Result delivery/configuration only, not a model retry.
    }
    return prior;
  }
  const job = await gradingQueue.add('grade-submission', { task, batchId: opts?.batchId }, {
    jobId, removeOnComplete: true, removeOnFail: false,
  });
  // Redis deduplicates concurrent adds; inspect the actual winning payload.
  const actual = await gradingQueue.getJob(jobId);
  if (actual && (actual.data.task?.requestHash !== task.requestHash || actual.data.batchId !== opts?.batchId)) {
    throw new GradingRequestError(409, 'SUBMISSION_CONFLICT', 'A concurrent request used this submission ID with different data');
  }
  return job;
}

export function startWorker() {
  const worker = new Worker(
    'grading',
    async (job: Job) => {
      const payload = job.data as { task: GradingTask; batchId?: string };
      coreGradeCallbackUrl(); // Fail configuration before any paid grading.
      let result: GradeResult;
      try {
        result = await gradeStoredTask(payload.task);
      } catch (error) {
        if (payload.batchId && payload.task?.submission?.id) {
          const saved = await submissionsStore.get(payload.task.submission.id);
          if (saved?.status === 'failed' && saved.requestHash === payload.task.requestHash) {
            await batchStore.markFailed(payload.batchId, payload.task.submission.id, 'Grading requires manual review');
          }
        }
        throw error;
      }

      try {
        if (payload.batchId) await batchStore.markCompleted(payload.batchId, payload.task.submission.id, result);
        const feedback = result.details
          .map((d) => d.feedback)
          .filter(Boolean)
          .join('\n');

        // Normalise raw totalScore to a 0-100 percentage
        const maxScore = result.details.reduce((sum, d) => sum + d.maxScore, 0);
        const scorePercent = maxScore > 0 ? Math.round((result.totalScore / maxScore) * 100) : 0;

        await postGradeCallback({
          submissionId: payload.task.submission.id,
          score: scorePercent,
          maxScore,
          feedback: feedback || undefined,
          published: canAutoPublish(result),
          requiresTeacherReview: !canAutoPublish(result),
        });
        await submissionsStore.setDeliveryError(payload.task.submission.id, payload.task.requestHash, false);
      } catch {
        await submissionsStore.setDeliveryError(payload.task.submission.id, payload.task.requestHash, true);
        throw new Error('Saved grading result requires delivery attention; retry must reuse the result');
      }

      return result;
    },
    { connection },
  );

  worker.on('failed', () => {
    // Ownership-sensitive failure persistence happens in gradeStoredTask.
    // Delivery errors must not erase completed grades or expose private payloads.
    console.error('Assess job failed; inspect its protected result status');
  });

  console.log('Grading worker started');
  return worker;
}
