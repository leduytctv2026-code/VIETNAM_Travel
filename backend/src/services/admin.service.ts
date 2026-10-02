import mongoose from "mongoose";
import {
  models,
  contentCollections,
  type Collection,
  type ContentCollection,
} from "../models/index.ts";
import { AppError, pagination, escapeRegex } from "../utils/http.ts";
import { rejectOperators } from "../middleware/security.ts";
import { objectId } from "../validators/community.ts";
import type { MediaProvider } from "../providers/media.ts";
import { z } from "zod";
export function collection(value: string): Collection {
  if (!Object.hasOwn(models, value))
    throw new AppError(404, "Danh mục không tồn tại.");
  return value as Collection;
}
export async function adminList(
  entity: Collection,
  params: Record<string, unknown>,
) {
  const { page, limit, skip } = pagination(params);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof params.status === "string" && params.status !== "all")
    filter.status = params.status;
  if (typeof params.q === "string" && params.q) {
    const q = escapeRegex(params.q.slice(0, 100));
    filter.$or = [
      { "name.vi": { $regex: q, $options: "i" } },
      { "name.en": { $regex: q, $options: "i" } },
      { guestName: { $regex: q, $options: "i" } },
    ];
  }
  const query = models[entity]
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  if (entity === "community" || entity === "comments")
    query.populate("destinationId", "name slug");
  return {
    data: await query.lean(),
    pagination: {
      page,
      limit,
      total: await models[entity].countDocuments(filter),
      pages: Math.ceil((await models[entity].countDocuments(filter)) / limit),
    },
  };
}
async function references(data: Record<string, unknown>) {
  for (const [key, entity] of [
    ["regionId", "regions"],
    ["provinceId", "provinces"],
  ] as const) {
    if (data[key] !== undefined) {
      const id = objectId.parse(data[key]);
      if (!(await models[entity].exists({ _id: id, deletedAt: null })))
        throw new AppError(400, "Tham chiếu không tồn tại.");
    }
  }
}
function clean(data: unknown) {
  rejectOperators(data);
  const row = z.record(z.string(), z.unknown()).parse(data);
  for (const key of [
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "moderatedBy",
    "moderatedAt",
  ])
    if (key in row) throw new AppError(400, `Không thể sửa trường ${key}.`);
  return row;
}
export async function saveContent(
  entity: Collection,
  input: unknown,
  id?: string,
) {
  if (!contentCollections.includes(entity as ContentCollection))
    throw new AppError(405, "Danh mục này có quy trình riêng.");
  const data = clean(input);
  await references(data);
  if (!id) return models[entity].create(data);
  objectId.parse(id);
  const document = await models[entity].findOne({ _id: id, deletedAt: null });
  if (!document) throw new AppError(404, "Không tìm thấy bản ghi.");
  document.set(data);
  await document.save();
  return document;
}
const mediaUrlPattern = /^\/api\/v1\/media\/([a-f\d]{24})$/i;

function collectMediaIds(value: unknown, ids = new Set<string>()) {
  if (typeof value === "string") {
    const match = value.match(mediaUrlPattern);
    if (match) ids.add(match[1].toLowerCase());
    return ids;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaIds(item, ids));
    return ids;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectMediaIds(item, ids),
    );
  }
  return ids;
}

async function referencedMediaIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const urls = ids.map((id) => `/api/v1/media/${id}`);
  const fields = [
    { heroImage: { $in: urls } },
    { images: { $in: urls } },
    { gallery: { $in: urls } },
    { officialGallery: { $in: urls } },
    { "history.events.image": { $in: urls } },
    { "history.beforeImage": { $in: urls } },
    { "history.afterImage": { $in: urls } },
  ];
  const used = new Set<string>();
  const contentRows = await Promise.all(
    contentCollections.map((name) =>
      models[name].find({ deletedAt: null, $or: fields }).lean(),
    ),
  );
  contentRows.flat().forEach((row) => collectMediaIds(row, used));

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const communityRows = await models.community
    .find({
      deletedAt: null,
      $or: [{ image: { $in: urls } }, { mediaId: { $in: objectIds } }],
    })
    .select("image mediaId")
    .lean();
  communityRows.forEach((row) => {
    collectMediaIds(row.image, used);
    if (row.mediaId) used.add(String(row.mediaId).toLowerCase());
  });
  return used;
}

async function purgeContentMedia(ids: Set<string>, provider?: MediaProvider) {
  if (!provider || !ids.size) return 0;
  const idList = [...ids];
  const used = await referencedMediaIds(idList);
  const mediaRows = await models.media
    .find({
      _id: { $in: idList.map((id) => new mongoose.Types.ObjectId(id)) },
      deletedAt: null,
    })
    .lean();
  let deleted = 0;
  for (const media of mediaRows) {
    const mediaId = String(media._id).toLowerCase();
    if (used.has(mediaId)) continue;
    try {
      await provider.delete(media.key);
      const result = await models.media.deleteOne({ _id: media._id });
      deleted += result.deletedCount;
    } catch (error) {
      console.warn("Unable to remove media object", media._id, error);
    }
  }
  return deleted;
}

export async function removeContent(
  entity: Collection,
  id: string,
  provider?: MediaProvider,
) {
  objectId.parse(id);
  if (entity === "media")
    throw new AppError(405, "Dùng quy trình quản lý media.");
  const dependencies: Partial<Record<Collection, [Collection, string][]>> = {
    regions: [["provinces", "regionId"]],
    provinces: [
      ["destinations", "provinceId"],
      ["specialties", "provinceId"],
    ],
  };
  for (const [related, field] of dependencies[entity] || [])
    if (await models[related].exists({ [field]: id, deletedAt: null }))
      throw new AppError(409, "Hãy chuyển hoặc xóa nội dung phụ thuộc trước.");
  const document = await models[entity].findOne({ _id: id, deletedAt: null });
  if (!document) throw new AppError(404, "Không tìm thấy bản ghi.");
  const mediaIds = collectMediaIds(document.toObject());
  const result = await models[entity].deleteOne({ _id: id, deletedAt: null });
  if (!result.deletedCount) throw new AppError(404, "Không tìm thấy bản ghi.");
  return {
    id,
    deleted: true,
    mediaDeleted: await purgeContentMedia(mediaIds, provider),
  };
}
export async function moderate(
  entity: "community" | "comments",
  input: unknown,
  adminId: string,
) {
  const { ids, action } = z
    .object({
      ids: z.array(objectId).min(1).max(100),
      action: z.enum(["approve", "reject"]),
    })
    .strict()
    .parse(input);
  const result = await models[entity].updateMany(
    { _id: { $in: ids }, deletedAt: null },
    {
      $set: {
        status: action === "approve" ? "approved" : "rejected",
        moderatedBy: new mongoose.Types.ObjectId(adminId),
        moderatedAt: new Date(),
      },
    },
    { runValidators: true },
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
}
export async function dashboard() {
  const counts = await Promise.all([
    models.provinces.countDocuments({ deletedAt: null }),
    models.destinations.countDocuments({ deletedAt: null }),
    models.specialties.countDocuments({ deletedAt: null }),
    models.community.countDocuments({ deletedAt: null }),
    models.community.countDocuments({ deletedAt: null, status: "pending" }),
    models.comments.countDocuments({ deletedAt: null, status: "pending" }),
  ]);
  const [posts, comments] = await Promise.all([
    models.community
      .find({ deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("destinationId", "name slug")
      .lean(),
    models.comments
      .find({ deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("destinationId", "name slug")
      .lean(),
  ]);
  return {
    counts: Object.fromEntries(
      [
        "provinces",
        "destinations",
        "specialties",
        "community",
        "pendingImages",
        "pendingComments",
      ].map((key, index) => [key, counts[index]]),
    ),
    recent: [...posts, ...comments],
  };
}
