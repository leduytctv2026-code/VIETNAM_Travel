import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../backend/src/config/database.js";
import {
  models,
  Admin,
  User,
  OAuthAccount,
  RateBucket,
} from "../backend/src/models/index.js";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
await connectDatabase(process.env.DATABASE_URL);
try {
  for (const model of [
    ...Object.values(models),
    Admin,
    User,
    OAuthAccount,
    RateBucket,
  ]) {
    await model.createIndexes();
    console.log(`Indexes ready: ${model.modelName}`);
  }
} finally {
  await mongoose.disconnect();
}
