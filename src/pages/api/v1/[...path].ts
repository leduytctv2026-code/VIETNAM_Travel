import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";

import { createApp } from "../../../../backend/src/app.ts";
import { readConfig } from "../../../../backend/src/config/env.ts";
import { connectDatabase } from "../../../../backend/src/config/database.ts";

type Runtime = {
  app: ReturnType<typeof createApp>;
  databaseUrl: string;
};

let runtime: Runtime | undefined;
let databaseConnection: Promise<void> | undefined;

function getRuntime() {
  if (runtime) return runtime;
  const config = readConfig();
  runtime = {
    app: createApp(config),
    databaseUrl: config.DATABASE_URL,
  };
  return runtime;
}

async function ensureDatabase(databaseUrl: string) {
  if (mongoose.connection.readyState === 1) return;
  if (!databaseConnection || mongoose.connection.readyState === 0) {
    databaseConnection = connectDatabase(databaseUrl).catch((error) => {
      databaseConnection = undefined;
      throw error;
    });
  }
  await databaseConnection;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const currentRuntime = getRuntime();
    await ensureDatabase(currentRuntime.databaseUrl);
    currentRuntime.app(req, res);
  } catch (error) {
    console.error(
      "Vercel API initialization failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    if (!res.headersSent)
      res.status(503).json({
        success: false,
        data: null,
        message: "Dịch vụ tạm thời không khả dụng.",
      });
    else res.end();
  }
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
    responseLimit: false,
  },
  maxDuration: 60,
};
