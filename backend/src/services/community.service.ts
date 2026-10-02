import { models } from "../models/index.ts";
import { publicFilter } from "../repositories/content.repository.ts";
import { AppError, pagination } from "../utils/http.ts";
import type { Config } from "../config/env.ts";
import type { MediaProvider } from "../providers/media.ts";
import type { UserIdentity } from "../middleware/security.ts";
import { storeImage } from "./media.service.ts";
import {
  commentSchema,
  photoSchema,
  objectId,
} from "../validators/community.ts";
async function publicDestination(id: string) {
  if (
    !(await models.destinations.exists({
      ...(await publicFilter("destinations")),
      _id: id,
    }))
  )
    throw new AppError(404, "Địa danh chưa được công bố.");
}
async function captcha(token: string | undefined, config: Config) {
  if (!config.CAPTCHA_SECRET) return;
  if (!token) throw new AppError(400, "Vui lòng hoàn thành xác minh.");
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: config.CAPTCHA_SECRET,
        response: token,
      }),
      signal: AbortSignal.timeout(5000),
    },
  );
  const data = (await response.json()) as {
    success: boolean;
    hostname?: string;
  };
  if (!data.success || data.hostname !== new URL(config.FRONTEND_URL).hostname)
    throw new AppError(400, "Xác minh chưa thành công.");
}
export async function submitPhoto(
  input: unknown,
  file: Express.Multer.File | undefined,
  provider: MediaProvider,
  config: Config,
  user: UserIdentity,
) {
  const data = photoSchema.parse(input);
  await publicDestination(data.destinationId);
  await captcha(data.captchaToken, config);
  const stored = await storeImage(file, provider, config, "community");
  try {
    const caption =
      data.locale === "en"
        ? { vi: "", en: data.caption }
        : { vi: data.caption, en: "" };
    const post = await models.community.create({
      destinationId: data.destinationId,
      authorId: user.id,
      // Legacy display-name fields are capped at 80 characters. Keep the
      // immutable author snapshot valid even when a profile name is longer.
      guestName: user.name.slice(0, 80),
      caption,
      image: stored.url,
      mediaId: stored.media._id,
      takenAt: data.takenAt || undefined,
      originalLocale: data.locale,
      status: "pending",
    });
    return { id: post._id, status: post.status };
  } catch (error) {
    await provider.delete(stored.media.key);
    await models.media.deleteOne({ _id: stored.media._id });
    throw error;
  }
}
export async function submitComment(
  input: unknown,
  config: Config,
  user: UserIdentity,
) {
  const data = commentSchema.parse(input);
  await publicDestination(data.destinationId);
  await captcha(data.captchaToken, config);
  if (
    data.communityPostId &&
    !(await models.community.exists({
      _id: data.communityPostId,
      destinationId: data.destinationId,
      status: "approved",
      deletedAt: null,
    }))
  )
    throw new AppError(404, "Ảnh chưa được công bố.");
  const post = await models.comments.create({
    destinationId: data.destinationId,
    communityPostId: data.communityPostId,
    authorId: user.id,
    guestName: user.name.slice(0, 80),
    content: {
      vi: data.locale === "vi" ? data.content : "",
      en: data.locale === "en" ? data.content : "",
    },
    originalLocale: data.locale,
    status: "pending",
  });
  return { id: post._id, status: post.status };
}
export async function communityList(
  kind: "community" | "comments",
  params: Record<string, unknown>,
) {
  const { page, limit, skip } = pagination(params);
  const destinationIds = await models.destinations
    .find(await publicFilter("destinations"))
    .distinct("_id");
  const filter: Record<string, unknown> = {
    status: "approved",
    deletedAt: null,
    destinationId: { $in: destinationIds },
  };
  if (params.destinationId) {
    const id = objectId.parse(params.destinationId);
    filter.$and = [{ destinationId: id }];
  }
  if (kind === "comments") {
    if (params.communityPostId) {
      const id = objectId.parse(params.communityPostId);
      const parent = await models.community
        .findOne({ _id: id, status: "approved", deletedAt: null })
        .select("destinationId");
      if (!parent)
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      filter.communityPostId = id;
      filter.$and = [
        ...((filter.$and as object[]) || []),
        { destinationId: parent.destinationId },
      ];
    } else filter.communityPostId = { $exists: false };
  }
  const query = models[kind]
    .find(filter)
    .select("-moderatedBy -deletedAt -__v -mediaId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  if (kind === "community")
    query.populate("destinationId", "name slug provinceId");
  const [data, total] = await Promise.all([
    query.lean(),
    models[kind].countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
