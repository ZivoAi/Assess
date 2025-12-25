# Assess — Architecture (MVP)

## Components

- API Server (Express + TypeScript)
- Grading Core (pluggable graders registered by question type)
- Graders: MCQ, Short answer (similarity), Essay (LLM + rubric), Code (sandboxed runner)
- Integrations / Connectors: HTTP client to accept submissions from platforms (Zivopal), webhooks for results
- Storage (MVP: in-memory; later: Postgres or DynamoDB)
- UI: Teacher dashboard to review, override, export grades
- Observability: logs, metrics, request tracing

## Notes
- Graders are synchronous for MCQ/Short; essay and code may be asynchronous and run as background jobs (recommended: Redis + BullMQ).
- Use OpenAI (or other LLM) for essay rubrics and **embeddings for short-answer comparison**. For high accuracy use embeddings for short answers with cosine similarity and thresholding; the repo implements embedding-based short-answer grading with graceful fallback to token overlap when embeddings are not available.
- Code grading should be executed inside secure sandboxes (Docker-in-Docker or remote runner) with time and resource limits.
- Security: API tokens for integrations, HMAC signature verification for webhooks, rate-limiting and request verification.

## Next implementation milestones
1. Add background worker using Redis + BullMQ to perform CPU/IO heavy grading tasks (essay LLM calls, code sandboxing) — implemented in `src/worker`.
2. Add persistent storage (Postgres) for assignments, submissions and audit logs.
3. Implement secure code runner service with Docker and test isolation.
4. Build Teacher UI to review and override grades with audit trail.

