import { createApp } from './app';
import { PORT } from './config';

const app = createApp();

app.listen(PORT, () => {
  console.log(`Assess server running on http://localhost:${PORT}`);
});
