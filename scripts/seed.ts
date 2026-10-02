import "dotenv/config";
import { connectDatabase } from "../backend/src/config/database.js";
import { seedDatabase } from "../backend/src/seed.js";
import mongoose from "mongoose";
if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD)
  throw new Error(
    "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters).",
  );
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL must point to MongoDB Atlas.");
await connectDatabase(
  process.env.DATABASE_URL,
);
try {
  console.log(
    await seedDatabase(
      process.env.SEED_ADMIN_EMAIL,
      process.env.SEED_ADMIN_PASSWORD,
    ),
  );
} finally {
  await mongoose.disconnect();
}
