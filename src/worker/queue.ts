import { Queue, Worker, QueueScheduler, Job } from 'bullmq';
  import IORedis from 'ioredis';
  import { runGradingPipeline } from '../grader/core.js';
  import { assignments } from '../api/assignments.js';
  import { submissionsStore } from '../store/submissionsStore.js';
  import { batchStore } from '../store/batchStore.js';
  import { registry } from '../grader/registry.js';
  import { REDIS_URL, ZIVOPAL_CORE_URL, ZIVOPAL_SERVICE_KEY } from '../config.js';
  import type { GradeResult } from '../types.js';

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  export const gradingQueue = new Queue('grading', { connection });
  export const gradingScheduler = new QueueScheduler('grading', { connection });

  export async function enqueueGradingJob(submission: any, opts?: { batchId?: string }) {
    const payload = { ...submission, batchId: opts?.batchId };
    return gradingQueue.add('grade-submission', payload, { removeOnComplete: true, removeOnFail: false });
  }

  async function postGradeCallback(url: string, body: object): Promise<void> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': ZIVOPAL_SERVICE_KEY,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        console.warn(`Grade callback failed: ${res.status} ${text}`);
      }
    } catch (err: any) {
      console.warn('Grade callback error:', err.message);
    }
  }

  export function startWorker() {
    const worker = new Worker(
      'grading',
      async (job: Job) => {
        const payload = job.data;

        const assignment = assignments.get(payload.assignmentId);
        if (!assignment) {
          throw new Error('Assignment not found');
        }

        const result: GradeResult = await runGradingPipeline(
          assignment.questions,
          payload.answers || {},
          registry,
          payload.id,
        );

        submissionsStore.setResult(payload.id, result);

        if (payload.batchId) {
          try {
            await batchStore.markCompleted(payload.batchId, payload.id, result);
          } catch (e) {
            console.warn('Failed to update batch progress', (e as Error).message);
          }
        }

        const callbackUrl =
          payload.callbackUrl ||
          (ZIVOPAL_CORE_URL ? `${ZIVOPAL_CORE_URL}/api/grades/callback` : null);

        if (callbackUrl) {
          const feedback = result.details
            .map((d) => d.feedback)
            .filter(Boolean)
            .join('\n');
          await postGradeCallback(callbackUrl, {
            submissionId: payload.id,
            score: result.totalScore,
            feedback: feedback || undefined,
            published: true,
          });
        }

        return result;
      },
      { connection },
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
  