import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "./config/database.ts";
import { seedDatabase } from "./seed.ts";
if (
  !process.env.SEED_ADMIN_EMAIL ||
  !process.env.SEED_ADMIN_PASSWORD ||
  !process.env.DATABASE_URL
)
  throw new Error("DATABASE_URL and SEED_ADMIN_EMAIL/PASSWORD are required.");
await connectDatabase(process.env.DATABASE_URL);
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
