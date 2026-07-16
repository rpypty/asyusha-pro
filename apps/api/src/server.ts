import { buildApp } from "./app.js";
import { config } from "./config.js";
import { startTelegramWorkers } from "./telegram.js";

const app = await buildApp();
startTelegramWorkers(app);

try {
  await app.listen({
    host: config.HOST,
    port: config.PORT
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
