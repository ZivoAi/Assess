import { Queue, Worker, QueueScheduler, Job } from 'bullmq';
import IORedis from 'ioredis';
import { runGradingPipeline } from '../grader/core';
import { assignments } from '../api/assignments';
import { submissionsStore } from '../store/submissionsStore';
import { batchStore } from '../store/batchStore';
import { registry } from '../grader/registry';
import type { GradeResult } from '../types';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const gradingQueue = new Queue('grading', { connection });
export const gradingScheduler = new QueueScheduler('grading', { connection });

export async function enqueueGradingJob(submission: any, opts?: { batchId?: string }) {
  const payload = { ...submission, batchId: opts?.batchId };
  return gradingQueue.add('grade-submission', payload, { removeOnComplete: true, removeOnFail: false });
}

export function startWorker() {
  // Worker that processes grading jobs
  const worker = new Worker(
    'grading',
    async (job: Job) => {
      const payload = job.data;
      // Validation
      const assignment = assignments.get(payload.assignmentId);
      if (!assignment) {
        throw new Error('Assignment not found');
      }

      const result: GradeResult = await runGradingPipeline(assignment.questions, payload.answers || {}, registry, payload.id);

      // Persist result
      submissionsStore.setResult(payload.id, result);

      // Update batch progress if part of a batch
      if (payload.batchId) {
        try {
          await batchStore.markCompleted(payload.batchId, payload.id, result);
        } catch (e) {
          console.warn('Failed to update batch progress', (e as Error).message);
        }
      }

      return result;
    },
    { connection }
  );

  worker.on('failed', async (job: Job | undefined, err: Error) => {
    console.error('Job failed', job?.id, err?.message);
    const submissionId = String(job?.data?.id ?? job?.id ?? '');
    submissionsStore.setFailed(submissionId, String(err?.message));
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
