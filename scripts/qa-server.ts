/** Isolated real API + MongoDB for local acceptance checks. Never uses the configured database. */
import "dotenv/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createApp } from "../backend/src/app.js";
import { readConfig } from "../backend/src/config/env.js";
import { connectDatabase } from "../backend/src/config/database.js";
import { seedDatabase } from "../backend/src/seed.js";

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri("redesign_acceptance");
await connectDatabase(uri);
await seedDatabase(
  process.env.SEED_ADMIN_EMAIL!,
  process.env.SEED_ADMIN_PASSWORD!,
  { includeSampleContent: true },
);
const port = Number(process.env.QA_PORT || 5000);
const server = createApp(
  readConfig({
    ...process.env,
    DATABASE_URL: uri,
    NODE_ENV: "test",
    MEDIA_ROOT: ".local/qa-media",
    CAPTCHA_SECRET: "",
    CAPTCHA_SITE_KEY: "",
  }),
).listen(port, () =>
  console.log(`Isolated seeded QA API listening on ${port}`),
);
async function stop() {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
