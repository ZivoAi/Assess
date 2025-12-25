# Integrations (Zivopal example)

The platform should POST a JSON payload to `/api/integrations/zivopal/webhook` with the following shape:

{
  "submission": {
    "id": "s1",
    "assignmentId": "a1",
    "studentId": "stu1",
    "answers": { "q1": 2 }
  }
}

Respond with 200 OK. Optionally, the platform can poll a `GET /api/submissions/:id/result` endpoint (not yet implemented) or provide a callback URL in the payload for async grading results.

Security: Use an HMAC signature header or API key in production.
