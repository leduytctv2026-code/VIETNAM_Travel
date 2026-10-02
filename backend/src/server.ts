import { readConfig } from "./config/env.ts";
import { connectDatabase } from "./config/database.ts";
import { createApp } from "./app.ts";
import mongoose from "mongoose";

const config = readConfig();
let memoryServer: { stop: () => Promise<boolean> } | null = null;

try {
  await connectDatabase(config.DATABASE_URL);
} catch (error) {
  if (config.NODE_ENV !== "production") {
    const reason =
      error instanceof Error ? error.message.split("\n")[0] : String(error);
    console.warn(`\n⚠️  Không thể kết nối MongoDB Atlas: ${reason}`);
    console.warn(
      "🔄 Đang tự động kích hoạt In-Memory MongoDB Server để website chạy mượt mà ngay lập tức...\n",
    );
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const localMemoryServer = await MongoMemoryServer.create();
    memoryServer = localMemoryServer;
    const uri = localMemoryServer.getUri("vietnam-heritage");
    await connectDatabase(uri);
    const { seedDatabase } = await import("./seed.ts");
    await seedDatabase(
      process.env.SEED_ADMIN_EMAIL || "editor@heritage.local",
      process.env.SEED_ADMIN_PASSWORD || "AdminPass123456!",
    );
    console.log(
      "✅ In-Memory Database đã khởi tạo & nạp dữ liệu di sản đầy đủ!\n",
    );
  } else {
    throw error;
  }
}

const server = createApp(config).listen(config.PORT, "0.0.0.0", () =>
  console.log(`Heritage API: http://localhost:${config.PORT}/api/v1`),
);

async function stop() {
  server.close(async () => {
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
    process.exit(0);
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
