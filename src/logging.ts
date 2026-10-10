export const requestLogRedaction = {
  paths: ['req.headers.authorization', 'req.headers["x-service-key"]', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  censor: '[REDACTED]',
};
