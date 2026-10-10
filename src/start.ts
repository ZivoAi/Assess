import './config.js';

const role = process.env.ASSESS_PROCESS || 'api';
let entry: Promise<unknown>;
if (role === 'api') entry = import('./index.js');
else if (role === 'worker') entry = import('./worker/start.js');
else {
  console.error('ASSESS_PROCESS must be api or worker');
  process.exit(1);
}
entry!.catch(() => {
  console.error('Assess process entry failed to load');
  process.exit(1);
});
