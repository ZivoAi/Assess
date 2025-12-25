import express from 'express';

// Minimal skeleton for handling incoming webhooks from an external LMS/platform like Zivopal
export const zivopalRouter = express.Router();

// Example: platform posts {submission}
zivopalRouter.post('/webhook', (req, res) => {
  const payload = req.body;
  // TODO: validate signature, auth
  // TODO: enqueue grading job, or call grading pipeline directly
  console.log('Zivopal webhook received:', payload?.submission?.id);
  res.status(200).json({ received: true });
});
