# Assess — Auto Grading AI

Lightweight auto-grader for MCQ, short-answer (embedding similarity), and essay (LLM) question types. Pairs with **zivopal-core** as the primary submission source.

## Stack

- **Runtime:** Node.js 20 / TypeScript
- **Framework:** Express
- **Queue:** BullMQ + Redis (async grading for essay/code questions)
- **AI:** OpenAI (embeddings for short answers, LLM for essay scoring)

## Local development

```bash
npm ci
npm run dev          # API server on :3000
npm run start:worker # Background grading worker (requires Redis)
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (for AI grading) | OpenAI key for embeddings + essay LLM |
| `REDIS_URL` | Yes (for async jobs) | Redis connection string |
| `ZIVOPAL_CORE_URL` | Yes | URL of zivopal-core service |
| `ZIVOPAL_SERVICE_KEY` | Yes | Shared secret between assess and zivopal-core |
| `ALLOWED_ORIGINS` | Production | Comma-separated CORS origins |
| `PORT` | No | Defaults to 3000 |

## Railway deployment

Assess is deployed as part of the **zivopal-core Railway project** so both services share private networking and Redis.

### Services in the Railway project

| Service | Dockerfile | Start command |
|---|---|---|
| `assess-api` | `Dockerfile` | `node dist/index.js` |
| `assess-worker` | `Dockerfile.worker` | `node dist/worker/start.js` |
| `Redis` | Railway Redis plugin | — |

### Adding Assess to the existing Railway project

1. Open the zivopal-core Railway project.
2. **Add service → Deploy from GitHub repo** → select `ZivoAi/Assess`.
   - Railway will auto-detect `railway.toml` and use `Dockerfile` for the API service.
3. **Add a second service** for the worker → same repo, but set **Dockerfile path** to `Dockerfile.worker` in the service settings. Name it `assess-worker`.
4. **Add Redis** (if not already present) → Add Plugin → Redis. Share the `REDIS_URL` variable with both assess services.
5. Set the following env vars on **assess-api** and **assess-worker**:
   - `OPENAI_API_KEY`
   - `REDIS_URL` (from the Redis plugin — Railway injects this automatically if you use the shared variable)
   - `ZIVOPAL_CORE_URL` → use the internal URL: `http://zivopal-core.railway.internal:<port>`
   - `ZIVOPAL_SERVICE_KEY`
   - `ALLOWED_ORIGINS` (on api only)

### Internal networking tip

Because assess and zivopal-core are in the same Railway project, use Railway's private network for service-to-service calls:
- `ZIVOPAL_CORE_URL=http://zivopal-core.railway.internal:3000` (replace port with zivopal-core's actual port)
- This avoids the public internet and doesn't count against egress.

## User preferences

<!-- Add any remembered preferences here -->
