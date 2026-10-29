import { env } from './config/env.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();
app.listen(env.port, () => {
  console.log(`job-portal API listening on :${env.port}`);
  if (process.env.DISABLE_SCHEDULER !== 'true') startScheduler();
});
