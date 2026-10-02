import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import type { Config } from "./config/env.ts";
import { createMediaProvider, type MediaProvider } from "./providers/media.ts";
import { originGuard, rejectOperators } from "./middleware/security.ts";
import { errorHandler } from "./middleware/errors.ts";
import { routes } from "./routes/index.ts";
import { AppError } from "./utils/http.ts";
import { openApi } from "./openapi.ts";
export function createApp(
  config: Config,
  provider: MediaProvider = createMediaProvider(config),
) {
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY_HOPS) app.set("trust proxy", config.TRUST_PROXY_HOPS);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: config.NODE_ENV === "test" ? 2000 : 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        data: null,
        message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
      },
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(originGuard(config));
  app.use((req, _res, next) => {
    try {
      rejectOperators(req.body);
      next();
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/v1/openapi.json", (_req, res) => res.json(openApi));
  app.use("/api/v1", routes(config, provider));
  app.use((_req, _res, next) => next(new AppError(404, "Không tìm thấy API.")));
  app.use(errorHandler);
  return app;
}
