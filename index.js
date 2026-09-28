import "dotenv/config";
import { createApp } from "./src/app.js";
import { getConfig } from "./src/config/index.js";
import { openDatabase } from "./src/db/index.js";
import { log } from "./src/utils/logger.js";

const config = getConfig();

if (config.jwtSecret === "dev-only-change-me") {
  log.info("JWT_SECRET is the default value. Set a real secret before sharing this service.");
}
if (config.webhookSecret === "dev-webhook-secret") {
  log.info("WEBHOOK_SECRET is the default value. Set a real secret before sharing this service.");
}

const db = openDatabase(config.databasePath);
const app = createApp({ db });

const server = app.listen(config.port, () => {
  log.info("server started", { port: config.port });
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
