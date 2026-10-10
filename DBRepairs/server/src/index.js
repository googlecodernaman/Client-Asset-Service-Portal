import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase, migrate } from "./db.js";

const config = loadConfig();
const db = createDatabase(config);

async function close(signal) {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  db.close();
  process.exit(0);
}

migrate(db);
const app = buildApp({ db, config, migrateDatabase: () => migrate(db) });
process.on("SIGTERM", () => void close("SIGTERM"));
process.on("SIGINT", () => void close("SIGINT"));
await app.listen({ host: config.host, port: config.port });
