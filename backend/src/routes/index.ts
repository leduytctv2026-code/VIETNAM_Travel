import { Router } from "express";
import multer from "multer";
import { pipeline } from "node:stream/promises";
import type { Config } from "../config/env.ts";
import type { MediaProvider } from "../providers/media.ts";
import * as controller from "../controllers/api.controller.ts";
import {
  requireAdmin,
  requireUser,
  persistentLimit,
  authenticate,
  authenticateUser,
} from "../middleware/security.ts";
import { contentCollections, models } from "../models/index.ts";
import {
  communityList,
  submitComment,
  submitPhoto,
} from "../services/community.service.ts";
import { dashboard, moderate } from "../services/admin.service.ts";
import { storeImage } from "../services/media.service.ts";
import { publicFilter } from "../repositories/content.repository.ts";
import { send, AppError, translate, toJSON, language } from "../utils/http.ts";
import { objectId } from "../validators/community.ts";
export function routes(config: Config, provider: MediaProvider) {
  const router = Router();
  const protect = requireAdmin(config);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 8, fieldSize: 4096 },
    fileFilter: (_req, file, cb) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
        return cb(new AppError(400, "Chỉ chấp nhận JPEG, PNG, WebP."));
      cb(null, true);
    },
  }).single("image");
  router.get("/health", (_req, res) => send(res, { status: "ok" }));
  router.get("/config", (_req, res) =>
    send(res, { captchaSiteKey: config.CAPTCHA_SITE_KEY || null }),
  );
  router.post(
    "/auth/login",
    persistentLimit("login", 15),
    controller.login(config),
  );
  router.get("/auth/providers", controller.oauthProviders(config));
  router.post(
    "/auth/user/register",
    persistentLimit("user-register", 8),
    controller.registerUser(config),
  );
  router.post(
    "/auth/user/login",
    persistentLimit("user-login", 15),
    controller.loginUser(config),
  );
  router.post(
    "/auth/user/password/forgot",
    persistentLimit("user-password-forgot", 5),
    controller.forgotUserPassword(config),
  );
  router.post(
    "/auth/user/password/reset",
    persistentLimit("user-password-reset", 8),
    controller.resetUserPassword,
  );
  router.get(
    "/auth/google",
    persistentLimit("oauth-google", 20),
    controller.beginOAuth("google", config),
  );
  router.get("/auth/google/callback", controller.finishOAuth("google", config));
  router.get(
    "/auth/facebook",
    persistentLimit("oauth-facebook", 20),
    controller.beginOAuth("facebook", config),
  );
  router.get(
    "/auth/facebook/callback",
    controller.finishOAuth("facebook", config),
  );
  router.get("/auth/me", protect, (_req, res) => send(res, res.locals.admin));
  router.post("/auth/logout", protect, controller.logout(config));
  router.get("/auth/user/me", requireUser(config), controller.userMe);
  router.patch(
    "/auth/user/profile",
    requireUser(config),
    controller.updateUserProfile,
  );
  router.post(
    "/auth/user/logout",
    requireUser(config),
    controller.userLogout(config),
  );
  router.get("/discover", controller.home);
  router.get("/discover/random", controller.random);
  router.get("/search", controller.search);
  for (const entity of contentCollections) {
    router.get(`/${entity}`, controller.catalog(entity));
    router.get(`/${entity}/:slug`, controller.detail(entity));
  }
  router.get("/community", async (req, res) => {
    const result = await communityList("community", req.query);
    send(
      res,
      translate(toJSON(result.data), language(req.query.lang)),
      200,
      result.pagination,
    );
  });
  router.post(
    "/community",
    persistentLimit("photo", 8),
    requireUser(config),
    upload,
    async (req, res) =>
      send(
        res,
        await submitPhoto(
          req.body,
          req.file,
          provider,
          config,
          res.locals.user!,
        ),
        201,
      ),
  );
  router.get("/comments", async (req, res) => {
    const result = await communityList("comments", req.query);
    send(
      res,
      translate(toJSON(result.data), language(req.query.lang)),
      200,
      result.pagination,
    );
  });
  router.post(
    "/comments",
    persistentLimit("comment", 12),
    requireUser(config),
    async (req, res) =>
      send(res, await submitComment(req.body, config, res.locals.user!), 201),
  );
  router.get("/media/:id", async (req, res) => {
    const id = objectId.parse(req.params.id);
    const media = await models.media.findOne({ _id: id, deletedAt: null });
    if (!media) throw new AppError(404, "Không tìm thấy ảnh.");
    let allowed = media.purpose === "official";
    if (!allowed) {
      const post = await models.community
        .findOne({ mediaId: id, status: "approved", deletedAt: null })
        .select("destinationId");
      allowed =
        !!post &&
        !!(await models.destinations.exists({
          ...(await publicFilter("destinations")),
          _id: post.destinationId,
        }));
    }
    if (!allowed) {
      let owner = false;
      try {
        const user = await authenticateUser(req, config);
        owner = Boolean(
          await models.community.exists({
            mediaId: id,
            authorId: user.id,
            deletedAt: null,
          }),
        );
      } catch {
        // A valid admin session can still inspect all unpublished media.
      }
      if (!owner) await authenticate(req, config);
    }
    res.setHeader("Content-Type", "image/webp");
    res.setHeader(
      "Cache-Control",
      media.purpose === "official"
        ? "public, max-age=3600"
        : "private, no-store",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      await pipeline(await provider.read(media.key), res);
    } catch {
      if (!res.headersSent) throw new AppError(404, "Ảnh không khả dụng.");
    }
  });
  router.get("/admin/dashboard", protect, async (_req, res) =>
    send(res, await dashboard()),
  );
  router.get("/admin/account", protect, controller.adminAccount);
  router.patch(
    "/admin/account",
    protect,
    controller.updateAdminAccount(config),
  );
  router.get("/admin/settings", protect, (_req, res) =>
    send(res, {
      mediaProvider: config.MEDIA_PROVIDER,
      captchaEnabled: !!config.CAPTCHA_SECRET,
      uploadLimitMB: 4,
      defaultLanguage: "vi",
      frontendUrl: config.FRONTEND_URL,
    }),
  );
  router.post("/admin/media", protect, upload, async (req, res) => {
    const result = await storeImage(
      req.file,
      provider,
      config,
      "official",
      res.locals.admin!.id,
    );
    send(res, { ...result.media.toObject(), url: result.url }, 201);
  });
  router.delete("/admin/media/:id", protect, async (req, res) => {
    const id = objectId.parse(req.params.id);
    const url = provider.getUrl(id);
    const inUse = await Promise.all(
      contentCollections.map((entity) =>
        models[entity].exists({
          deletedAt: null,
          $or: [
            { heroImage: url },
            { images: url },
            { gallery: url },
            { officialGallery: url },
            { "history.events.image": url },
            { "history.beforeImage": url },
            { "history.afterImage": url },
          ],
        }),
      ),
    );
    if (
      inUse.some(Boolean) ||
      (await models.community.exists({ mediaId: id, deletedAt: null }))
    )
      throw new AppError(409, "Ảnh đang được dùng trong nội dung.");
    const media = await models.media.findOne({ _id: id, deletedAt: null });
    if (!media) throw new AppError(404, "Ảnh không tồn tại.");
    await provider.delete(media.key);
    await models.media.deleteOne({ _id: media._id });
    send(res, { deleted: true });
  });
  for (const entity of ["community", "comments"] as const)
    router.patch(`/admin/${entity}/moderate`, protect, async (req, res) =>
      send(res, await moderate(entity, req.body, res.locals.admin!.id)),
    );
  router.get("/admin/:entity", protect, controller.adminList);
  router.post("/admin/:entity", protect, controller.create);
  router.patch("/admin/:entity/:id", protect, controller.update);
  router.delete("/admin/:entity/:id", protect, controller.remove(provider));
  return router;
}
