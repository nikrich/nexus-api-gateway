import { createApp } from './server.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[API Gateway] listening on port ${config.port} (${config.nodeEnv})`);
});
