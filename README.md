# Assess — Auto Grading AI

Lightweight Auto-Grader MVP.

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
- Poll result: `GET /api/submissions/:id/result` returns status (pending/completed/failed) and result when available.
- For bulk marking, use `POST /api/batches` with `submissions: []`. The endpoint returns a `batchId` and `statusUrl`.
  - Optionally provide `callbackUrl` to receive webhook updates for batch progress and completion.
  - Check batch: `GET /api/batches/:id` for per-submission statuses.



Supported question types (MVP):
- `mcq` — multiple choice
- `short` — short text answers (embedding-based similarity using OpenAI embeddings with token-overlap fallback). Configure `SHORT_EMBEDDING_THRESHOLD` to tune sensitivity (default `0.72`).
- `essay` — essay scoring (LLM or keyword fallback)

This repo contains a modular grader registry for adding new graders.

