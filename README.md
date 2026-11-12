# Assess — Auto Grading AI

Core-integrated grading draft. This is not acceptance of production marking quality.
All `/api` routes require Core's `X-Service-Key`; they are not learner-facing APIs.

- Start the server: `npm run dev`
- POST assignments to `/api/assignments` with JSON assignment objects.
- POST submissions to `/api/submissions` to get grading result.

Development:

- Install dependencies: `npm ci`
- Run tests: `npm test`
- Build: `npm run build`
- Start worker (dev): `npm run start:worker` (requires Redis)

See `docs/` for architecture, API spec, and integrations examples.

Async grading behavior

- Submissions containing `essay` or `code` questions are enqueued for background grading and the API returns `202 Accepted` with a `resultUrl` to poll for status.
- Poll result: `GET /api/submissions/:id/result` returns status (pending/grading/completed/failed) and result when available.
- For bulk marking, use `POST /api/batches` with `submissions: []`. The endpoint returns a `batchId` and `statusUrl`.
  - Caller-supplied batch `callbackUrl` values are refused; there is no registered Core batch-progress receiver.
  - Check batch: `GET /api/batches/:id` for per-submission statuses.



Supported question types (MVP):
- `mcq` — multiple choice
- `short` — deterministic comparison by default; Core embeddings require explicit `ASSESS_USE_AI_EMBEDDINGS=true`.
- `essay` — provisional scoring through authenticated Core AI, not a keyword fallback when AI fails.

This repo contains a modular grader registry for adding new graders.

## Protected grading and delivery

Core supplies immutable learner/submission IDs and its stored task/answer, not
arbitrary learner-provided questions. Inline questions are stored as immutable
processing snapshots; later assignment edits can serve new submissions without
overwriting a queued snapshot or saved result.

Before paid work, PostgreSQL atomically claims a submission fingerprint covering
the learner ID, canonical assignment ID, answers and question snapshot. Redis job
IDs additionally deduplicate ingress. A completed result is reused on delivery
retry; delivery failures never replace it with `failed` or repeat model grading.
Started/failed attempts with uncertain provider completion and legacy records
without fingerprints require manual review. Do not automatically reset them.
These hashes are private integrity markers, not anonymized analytics identifiers.

Callbacks go only to Core's configured `/api/grades/callback`, with service
authentication, bounded retries and redirects refused. Scores remain subject to
Core's teacher review/publication policy. The Core adapter currently represents
stored written work as one provisional essay question; it is not an official
curriculum mark scheme, image grader or general code-grading acceptance.

Required existing configuration names: `DATABASE_URL`, `REDIS_URL`,
`ASSESS_DB_SCHEMA`, `ZIVOPAL_CORE_URL`, `ZIVOPAL_SERVICE_KEY`. Core's outbound
adapter uses `ASSESS_API_URL` and `ASSESS_SERVICE_KEY`. No provider credentials
belong in the client.

## Verification and rollout

`npm test` covers unit/contract checks. `npm run test:workflow` additionally
requires local PostgreSQL tools and Redis and creates disposable socket-only
services. It blocks external requests and uses synthetic provider/callback
responses, never live learner data or paid models. It tests actual API ingress,
BullMQ, claims, saved-result retries, failures, legacy protection, batch counters
and question snapshots. It is not a live deployed acceptance test.

No new Assess SQL migration is required: claims use existing status/result fields.
Pause ingress/queues and stop old consumers before introducing the new job
payload and claim protocol; do not run old and new workers together. Inspect and
reconcile active/legacy work before resuming; do not blindly execute/drain a
legacy backlog or replay uncertain attempts. Failed-job, snapshot and
integrity-marker retention and operator recovery still need an approved policy.

