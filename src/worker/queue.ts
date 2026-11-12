import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { runGradingPipeline, canAutoPublish } from '../grader/core.js';
import { getAssignment } from '../api/assignments.js';
import { submissionsStore } from '../store/submissionsStore.js';
import { batchStore } from '../store/batchStore.js';
import { registry } from '../grader/registry.js';
import { REDIS_URL } from '../config.js';
import { coreGradeCallbackUrl, postGradeCallback } from '../integrations/gradeCallback.js';
import type { GradeResult } from '../types.js';

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const gradingQueue = new Queue('grading', { connection });

export async function enqueueGradingJob(submission: any, opts?: { batchId?: string }) {
  const payload = { ...submission, batchId: opts?.batchId };
  return gradingQueue.add('grade-submission', payload, { removeOnComplete: true, removeOnFail: false });
}

export function startWorker() {
  const worker = new Worker(
    'grading',
    async (job: Job) => {
      const payload = job.data;
      coreGradeCallbackUrl(); // Fail configuration before any paid grading.

      const assignment = await getAssignment(payload.assignmentId);
      if (!assignment) {
        throw new Error('Assignment not found');
      }

      const result: GradeResult = await runGradingPipeline(
        assignment.questions,
        payload.answers || {},
        registry,
        payload.id,
      );

      await submissionsStore.setResult(payload.id, result);

      if (payload.batchId) {
        try {
          await batchStore.markCompleted(payload.batchId, payload.id, result);
        } catch (e) {
          console.warn('Failed to update batch progress', (e as Error).message);
        }
      }

      {
        const feedback = result.details
          .map((d) => d.feedback)
          .filter(Boolean)
          .join('\n');

        // Normalise raw totalScore to a 0-100 percentage
        const maxScore = result.details.reduce((sum, d) => sum + d.maxScore, 0);
        const scorePercent = maxScore > 0 ? Math.round((result.totalScore / maxScore) * 100) : 0;

        await postGradeCallback({
          submissionId: payload.id,
          score: scorePercent,
          maxScore,
          feedback: feedback || undefined,
          published: canAutoPublish(result),
          requiresTeacherReview: !canAutoPublish(result),
        });
      }

      return result;
    },
    { connection },
  );

  worker.on('failed', async (job: Job | undefined, err: Error) => {
    console.error('Job failed', job?.id, err?.message);
    const submissionId = String(job?.data?.id ?? job?.id ?? '');
    await submissionsStore.setFailed(submissionId, String(err?.message));
    if (job?.data?.batchId) {
      try {
        await batchStore.markFailed(job.data.batchId, job.data.id ?? submissionId, String(err?.message));
      } catch (e) {
        console.warn('Failed to mark batch failed', (e as Error).message);
      }
    }
  });

  console.log('Grading worker started');
  return worker;
}
