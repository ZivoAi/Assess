const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = process.env.ISOLATED_ASSESS_TEST_ROOT;
assert.match(root ?? '', /^\/tmp\/zivopal-assess-test\.[A-Za-z0-9]+$/);
assert.equal(new URL(process.env.DATABASE_URL).searchParams.get('host'), root);
assert.equal(process.env.REDIS_URL, root + '/redis.sock');
assert.equal(process.env.ZIVOPAL_CORE_URL, 'https://core.fixture.invalid');
assert.equal(process.env.NODE_ENV, 'test');
const nativeFetch = global.fetch;
let server, worker, gradingQueue, pool, code = 0, modelCalls = 0, callbackCalls = 0;
let failDelivery = true, failModel = false, holdModel = null, callbackBody;
global.fetch = async (input, options) => {
  const url = new URL(input);
  assert.equal(url.origin, 'https://core.fixture.invalid', 'External requests are forbidden');
  assert.equal(options.redirect, 'error');
  if (url.pathname === '/api/ai/internal/assess') {
    modelCalls++;
    if (holdModel) await holdModel;
    if (failModel) throw new Error('synthetic-private-provider-detail');
    return new Response(JSON.stringify({ score: 0.75, feedback: 'Synthetic feedback', requiresTeacherReview: true }));
  }
  assert.equal(url.pathname, '/api/grades/callback');
  callbackCalls++; callbackBody = JSON.parse(options.body);
  return new Response(JSON.stringify({ accepted: true }), { status: failDelivery ? 500 : 200 });
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 600; i++) { if (await check()) return; await delay(20); }
  throw new Error('Isolated workflow did not reach its expected state');
}
async function main() {
  ({ pool } = await import('../dist/db/client.js'));
  await (await import('../dist/db/migrate.js')).runMigrations();
  const queueModule = await import('../dist/worker/queue.js');
  gradingQueue = queueModule.gradingQueue;
  assert.equal((await gradingQueue.client).options.path, root + '/redis.sock');
  const { createApp } = await import('../dist/app.js');
  server = await new Promise(resolve => { const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener)); });
  worker = queueModule.startWorker(); await worker.waitUntilReady();
  const base = 'http://127.0.0.1:' + server.address().port;
  const { submissionsStore } = await import('../dist/store/submissionsStore.js');
  const { batchStore } = await import('../dist/store/batchStore.js');
  const { prepareGradingTask } = await import('../dist/grader/task.js');
  const { gradeStoredTask } = await import('../dist/grader/stored.js');
  async function call(path, body, auth = true) {
    const response = await nativeFetch(base + path, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(auth ? { 'X-Service-Key': 'synthetic-core-assess-workflow-key' } : {}),
    }, body: JSON.stringify(body), redirect: 'error' });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await call('/api/submissions', {}, false)).status, 401);
  const assignment = { id: 'synthetic-task', title: 'Synthetic written task', questions: [{ id: 'q1', type: 'essay', prompt: 'Synthetic question' }] };
  assert.equal((await call('/api/assignments', assignment)).status, 201);
  const input = { id: 'synthetic-submission', assignmentId: assignment.id, studentId: 'synthetic-student', answers: { q1: 'Synthetic written answer' } };
  const webhook = { ...input, submissionId: input.id, questions: assignment.questions };
  const accepted = await Promise.all([call('/api/integrations/zivopal/webhook', webhook), call('/api/integrations/zivopal/webhook', webhook)]);
  assert.deepEqual(accepted.map(r => r.status), [202, 202]);
  const jobId = createHash('sha256').update(input.id).digest('hex');
  await until(async () => (await (await gradingQueue.getJob(jobId))?.getState()) === 'failed');
  const saved = await submissionsStore.get(input.id);
  assert.equal(saved.status, 'completed'); assert.equal(saved.result.totalScore, 0.75);
  assert.ok(saved.error); assert.equal(modelCalls, 1); assert.equal(callbackCalls, 3);
  failDelivery = false;
  assert.equal((await call('/api/integrations/zivopal/webhook', webhook)).status, 202);
  await until(async () => !(await submissionsStore.get(input.id)).error);
  assert.equal(modelCalls, 1); assert.equal(callbackCalls, 4);
  assert.equal(callbackBody.published, false); assert.equal(callbackBody.requiresTeacherReview, true);
  assert.equal(callbackBody.submissionId, input.id);
  assert.equal((await call('/api/integrations/zivopal/webhook', { ...webhook, answers: { q1: 'Changed' } })).status, 409);
  assert.equal((await call('/api/integrations/zivopal/webhook', { ...webhook, studentId: 'different-student' })).status, 409);
  assert.equal((await call('/api/integrations/zivopal/webhook', { ...webhook, questions: [{ ...assignment.questions[0], prompt: 'Different question' }] })).status, 409);
  assert.equal(modelCalls, 1);
  console.log('PASS real API/Redis worker: concurrent duplicate ingress, saved-result delivery retry, source binding and teacher-review callback');

  const pending = await prepareGradingTask({ ...input, id: 'synthetic-concurrent' });
  await submissionsStore.createPending(pending.submission.id, pending.requestHash);
  let release;
  holdModel = new Promise(resolve => { release = resolve; });
  const first = gradeStoredTask(pending);
  await until(() => modelCalls === 2);
  await assert.rejects(gradeStoredTask(pending), error => error.code === 'GRADING_REVIEW_REQUIRED');
  assert.equal((await submissionsStore.get(pending.submission.id)).status, 'grading');
  release(); await first; holdModel = null;
  const uncertain = await prepareGradingTask({ ...input, id: 'synthetic-uncertain' });
  await submissionsStore.createPending(uncertain.submission.id, uncertain.requestHash);
  assert.equal(await submissionsStore.claim(uncertain.submission.id, uncertain.requestHash), true);
  await assert.rejects(gradeStoredTask(uncertain), error => error.code === 'GRADING_REVIEW_REQUIRED');
  assert.equal(modelCalls, 2);
  console.log('PASS PostgreSQL claim excludes concurrent/uncertain model execution without a Redis-only lock');

  failModel = true;
  const failed = await prepareGradingTask({ ...input, id: 'synthetic-failed' });
  await submissionsStore.createPending(failed.submission.id, failed.requestHash);
  await assert.rejects(gradeStoredTask(failed), error => error.code === 'GRADING_UNAVAILABLE');
  await assert.rejects(gradeStoredTask(failed), error => error.code === 'GRADING_REVIEW_REQUIRED');
  assert.equal(modelCalls, 3);
  assert.equal((await submissionsStore.get(failed.submission.id)).result, undefined);
  assert.doesNotMatch(JSON.stringify(await submissionsStore.get(failed.submission.id)), /private-provider/);
  failModel = false;
  await pool.query("INSERT INTO submissions (id, status) VALUES ('synthetic-legacy', 'pending')");
  assert.equal((await call('/api/submissions', { ...input, id: 'synthetic-legacy' })).status, 409);
  assert.equal((await submissionsStore.get('synthetic-legacy')).status, 'pending');
  console.log('PASS provider failures produce no invented mark; legacy/unbound records remain untouched');

  await batchStore.createBatch('synthetic-batch', 1);
  await batchStore.addSubmission('synthetic-batch', input.id);
  await batchStore.addSubmission('synthetic-batch', input.id);
  await batchStore.markCompleted('synthetic-batch', input.id, saved.result);
  await batchStore.markCompleted('synthetic-batch', input.id, saved.result);
  await batchStore.markFailed('synthetic-batch', input.id, 'Synthetic failure');
  const batch = await batchStore.get('synthetic-batch');
  assert.equal(batch.completedCount, 1); assert.equal(batch.failedCount, 0);
  assert.equal((await call('/api/batches', { submissions: [input], callbackUrl: 'http://169.254.169.254/' })).status, 400);
  console.log('PASS batch retries do not double-count or reset completion; caller-directed progress callbacks are refused');
  const edited = { ...webhook, submissionId: 'synthetic-after-edit', questions: [{ ...assignment.questions[0], prompt: 'Updated synthetic task' }] };
  assert.equal((await call('/api/integrations/zivopal/webhook', edited)).status, 202);
  await until(() => callbackBody.submissionId === edited.submissionId);
  assert.equal(modelCalls, 4);
  assert.equal((await submissionsStore.get(input.id)).result.totalScore, 0.75);
  console.log('PASS edited assignments use immutable question snapshots for new submissions without changing saved grades');
}
main().catch(error => { code = 1; console.error(error); }).finally(async () => {
  await worker?.close(); await gradingQueue?.close(); await pool?.end();
  if (server) await new Promise(resolve => server.close(resolve));
  process.exit(code); // The shared worker Redis connection belongs to this disposable process.
});
