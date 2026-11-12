const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual adapter with synthetic configuration and transport only.
function adapter(fetch, config = { ZIVOPAL_CORE_URL: 'https://core.test', ZIVOPAL_SERVICE_KEY: 'synthetic-key' }) {
  const source = fs.readFileSync(path.join(__dirname, '../src/llm/openai.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: () => config, URL, AbortSignal, fetch });
  return exports.scoreEssayWithOpenAI;
}
test('Assess calls Core with service auth, not a provider, and accepts a legitimate zero', async () => {
  const grade = adapter(async (url, init) => {
    assert.equal(String(url), 'https://core.test/api/ai/internal/assess');
    assert.equal(init.headers['X-Service-Key'], 'synthetic-key');
    assert.deepEqual(JSON.parse(init.body), { prompt: 'Synthetic assessment' });
    return { ok: true, json: async () => ({ score: 0, feedback: 'Synthetic feedback', requiresTeacherReview: true }) };
  });
  assert.equal(await grade('Synthetic assessment'), 0);
});
test('missing configuration fails before any request', async () => {
  await assert.rejects(adapter(() => assert.fail('No request allowed'), {})('Synthetic'), /requires/);
});
test('outages and malformed scores never become a mark', async () => {
  for (const result of [{ ok: false }, { ok: true, json: async () => ({ score: 2, requiresTeacherReview: true }) },
    { ok: true, json: async () => ({ score: 0.8, requiresTeacherReview: false }) }]) {
    await assert.rejects(adapter(async () => result)('Synthetic'), /no mark confirmed/);
  }
});

function modules(fetch, config = { ZIVOPAL_CORE_URL: 'https://core.test', ZIVOPAL_SERVICE_KEY: 'synthetic-key' }) {
  const cache = new Map();
  function load(filename) {
    if (filename.endsWith('/config.ts')) return config;
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const source = fs.readFileSync(filename, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, URL, AbortSignal, fetch, Buffer,
      require: relative => relative === 'node:crypto' ? require('node:crypto') : load(path.resolve(path.dirname(filename), relative).replace(/\.js$/, '.ts')) });
    return exports;
  }
  return file => load(path.join(__dirname, '../src', file));
}
test('actual essay pipeline keeps partial credit and requires teacher publication', async () => {
  const load = modules(async () => ({ ok: true, json: async () => ({ score: 0.4, feedback: 'Synthetic review feedback', requiresTeacherReview: true }) }));
  const { GraderRegistry, runGradingPipeline, canAutoPublish } = load('grader/core.ts');
  const { EssayGrader } = load('graders/essay.ts');
  const registry = new GraderRegistry();
  registry.register('essay', new EssayGrader());
  const result = await runGradingPipeline([{ id: 'q', type: 'essay', prompt: 'Synthetic question', rubric: { modelAnswer: 'Synthetic criteria' } }],
    { q: 'Synthetic answer' }, registry, 'synthetic-submission');
  assert.equal(result.totalScore, 0.4);
  assert.equal(result.details[0].feedback, 'Synthetic review feedback');
  assert.equal(result.requiresTeacherReview, true);
  assert.equal(canAutoPublish(result), false);
  assert.equal(canAutoPublish({ details: [{ score: 1, maxScore: 1 }] }), true);
});
test('essay failure cannot silently become a keyword-derived mark', async () => {
  const load = modules(async () => ({ ok: false }));
  const { EssayGrader } = load('graders/essay.ts');
  await assert.rejects(new EssayGrader().grade({ id: 'q', rubric: { keywords: ['synthetic'] } }, 'Synthetic'), /no mark confirmed/);
});
test('semantic short scoring routes embeddings through Core and never silently changes method', async () => {
  let calls = 0;
  const load = modules(async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://core.test/api/ai/internal/assess/embeddings');
    assert.equal(JSON.parse(init.body).texts.length, 1);
    return { ok: true, json: async () => ({ embeddings: [Array(1536).fill(1)], requiresTeacherReview: true }) };
  });
  const { ShortAnswerGrader } = load('graders/shortAnswer.ts');
  const result = await new ShortAnswerGrader(0.6, true).grade({ id: 'q', rubric: { modelAnswer: 'Synthetic reference' } }, 'Synthetic answer');
  assert.equal(calls, 2);
  assert.equal(result.requiresTeacherReview, true);
  const failed = modules(async () => ({ ok: false }))('graders/shortAnswer.ts');
  await assert.rejects(new failed.ShortAnswerGrader(0.6, true).grade({ id: 'q', rubric: { modelAnswer: 'Synthetic' } }, 'Synthetic'), /no mark confirmed/);
});
test('unsupported question types cannot fabricate zero marks', async () => {
  const { GraderRegistry, runGradingPipeline } = modules(() => assert.fail('No paid request'))('grader/core.ts');
  await assert.rejects(runGradingPipeline([{ id: 'q', type: 'unsupported' }], {}, new GraderRegistry(), 'synthetic'), /no mark confirmed/);
});
test('the worker publishes according to the review gate, not an unconditional flag', () => {
  const worker = fs.readFileSync(path.join(__dirname, '../src/worker/queue.ts'), 'utf8');
  assert.match(worker, /published:\s*canAutoPublish\(result\)/);
  assert.doesNotMatch(worker, /published:\s*true/);
});
test('grade delivery retries the callback only and never uses a caller-selected host', async () => {
  let calls = 0;
  const load = modules(async (url) => {
    assert.equal(String(url), 'https://core.test/api/grades/callback');
    calls++;
    return { ok: calls === 2, status: calls === 2 ? 200 : 503, headers: new Headers() };
  });
  const delays = [];
  await load('integrations/gradeCallback.ts').postGradeCallback({ submissionId: 'synthetic', published: false }, {
    wait: async ms => { delays.push(ms); },
  });
  assert.equal(calls, 2);
  assert.equal(delays.length, 1);
});
test('unauthorized callbacks are not retried or quietly marked delivered', async () => {
  let calls = 0;
  const load = modules(async () => { calls++; return { ok: false, status: 401, headers: new Headers() }; });
  await assert.rejects(load('integrations/gradeCallback.ts').postGradeCallback({}, { wait: async () => assert.fail('No retry') }), /saved result requires attention/);
  assert.equal(calls, 1);
});
test('Assess APIs require a configured private Core service credential', () => {
  const handler = modules(() => assert.fail('No network'))('middleware/coreServiceAuth.ts').requireCoreServiceKey;
  let advanced = 0;
  const response = { code: 0, status(code) { this.code = code; return this; }, json() {} };
  handler({ get: () => undefined }, response, () => advanced++);
  assert.equal(response.code, 401);
  handler({ get: () => 'synthetic-key' }, response, () => advanced++);
  assert.equal(advanced, 1);
  const unconfigured = modules(undefined, {})('middleware/coreServiceAuth.ts').requireCoreServiceKey;
  unconfigured({ get: () => 'synthetic-key' }, response, () => assert.fail('No bypass'));
  assert.equal(response.code, 503);
  const app = fs.readFileSync(path.join(__dirname, '../src/app.ts'), 'utf8');
  const guard = app.indexOf("app.use('/api', requireCoreServiceKey)");
  assert.ok(guard >= 0 && guard < app.indexOf("app.use('/api/assignments'"));
});
test('an unavailable code grader cannot fabricate a zero', async () => {
  const { CodeGrader } = modules(() => assert.fail('No network'))('graders/code.ts');
  await assert.rejects(new CodeGrader().grade({}, 'Synthetic code'), /no mark confirmed/);
});
