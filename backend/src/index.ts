import { createApp, startCron } from './app.js';
import { config } from './config.js';

const app = createApp();
startCron();

app.listen(config.port, () => {
  console.log(`jobdash backend listening on http://localhost:${config.port}`);
});
