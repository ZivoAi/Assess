# API (MVP)

## Create assignment
POST /api/assignments
Body: Assignment JSON
Response: 201 Created with assignment

Example:

curl -X POST http://localhost:3000/api/assignments \
  -H 'Content-Type: application/json' \
  -d '{"id":"a1","title":"Sample","questions":[{"id":"q1","type":"mcq","prompt":"Pick 2","options":["a","b","c"],"correctOptionIndex":2}]}'

## Get assignment
GET /api/assignments/:id

## List assignments
GET /api/assignments

## Submit student's answers
POST /api/submissions
Body: Submission JSON
Response: GradeResult JSON or 202 Accepted for async grading

Example:

curl -X POST http://localhost:3000/api/submissions \
  -H 'Content-Type: application/json' \
  -d '{"id":"s1","assignmentId":"a1","studentId":"stu1","answers":{"q1":2}}'

- If submission contains `essay` or `code` questions the server will enqueue a background job and return `202 Accepted` with `resultUrl` to poll.

## Check grading status/result
GET /api/submissions/:id/result

Returns: { submissionId, status: 'pending'|'completed'|'failed', result?, error? }

## Batch grading
POST /api/batches
Body: { submissions: Submission[], callbackUrl?: string }
Response: 202 Accepted with { batchId, statusUrl }

GET /api/batches/:id
Returns batch status and per-submission statuses. Optionally include `callbackUrl` in the POST to receive webhook progress updates (POST payloads will include { batchId, status, submissionId?, completedCount?, failedCount?, total? }).

## Integrations / Webhooks
- POST /api/integrations/zivopal/webhook -> receives submissions from Zivopal and returns 200 and schedules grading
