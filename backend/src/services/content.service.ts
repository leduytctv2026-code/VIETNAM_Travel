import mongoose from "mongoose";
import {
  models,
  type ContentCollection,
  contentCollections,
} from "../models/index.ts";
import {
  findContent,
  listContent,
  publicFilter,
  type RawContent,
} from "../repositories/content.repository.ts";
import { AppError, pagination, escapeRegex } from "../utils/http.ts";
export async function catalog(
  entity: ContentCollection,
  params: Record<string, unknown>,
) {
  const { page, limit, skip } = pagination(params);
  const filter = await publicFilter(entity);
  for (const field of ["regionId", "provinceId"])
    if (typeof params[field] === "string") {
      if (!mongoose.isValidObjectId(params[field]))
        throw new AppError(400, "Mã tham chiếu không hợp lệ.");
      filter.$and = [
        ...((filter.$and as object[]) || []),
        { [field]: params[field] },
      ];
    }
  if (typeof params.category === "string" && entity === "destinations")
    filter.category = params.category;
  if (typeof params.q === "string" && params.q.trim()) {
    const safe = escapeRegex(params.q.trim().slice(0, 100));
    filter.$or = [
      { "name.vi": { $regex: safe, $options: "i" } },
      { "name.en": { $regex: safe, $options: "i" } },
    ];
  }
  const sort: Record<string, 1 | -1> =
    params.sort === "newest"
      ? { createdAt: -1 as const }
      : { "name.vi": 1 as const };
  const result = await listContent(entity, filter, skip, limit, sort);
  return {
    data: result.items,
    pagination: {
      page,
      limit,
      total: result.total,
      pages: Math.ceil(result.total / limit),
    },
  };
}
export async function detail(entity: ContentCollection, slug: string) {
  const item = await findContent(entity, slug);
  if (!item) throw new AppError(404, "Không tìm thấy nội dung.");
  if (entity === "provinces") {
    const [destinations, specialties] = await Promise.all([
      listContent(
        "destinations",
        { ...(await publicFilter("destinations")), provinceId: item._id },
        0,
        100,
      ),
      listContent(
        "specialties",
        { ...(await publicFilter("specialties")), provinceId: item._id },
        0,
        100,
      ),
    ]);
    return {
      province: item,
      destinations: destinations.items,
      specialties: specialties.items,
    };
  }
  if (entity === "destinations")
    return { destination: item, nearby: await nearby(item) };
  if (entity === "specialties")
    return {
      specialty: item,
      related: (
        await listContent(
          "specialties",
          {
            ...(await publicFilter("specialties")),
            provinceId:
              typeof item.provinceId === "object"
                ? item.provinceId._id
                : item.provinceId,
            _id: { $ne: item._id },
          },
          0,
          6,
        )
      ).items,
    };
  return item;
}
export async function nearby(item: RawContent) {
  if (!item.location) return [];
  const filter = await publicFilter("destinations");
  const rows = await models.destinations.aggregate([
    {
      $geoNear: {
        near: item.location,
        distanceField: "distanceMeters",
        spherical: true,
        maxDistance: 100000,
        query: { ...filter, _id: { $ne: item._id } },
      },
    },
    { $limit: 6 },
    {
      $addFields: {
        distanceKm: { $round: [{ $divide: ["$distanceMeters", 1000] }, 1] },
      },
    },
  ]);
  return models.destinations.populate(rows, {
    path: "provinceId",
    select: "name slug",
  });
}
export async function homeData() {
  const results = await Promise.all(
    contentCollections.map(async (entity) => ({
      entity,
      ...(await listContent(
        entity,
        await publicFilter(entity),
        0,
        entity === "provinces" ? 100 : 12,
        entity === "regions" ? { order: 1 } : { "name.vi": 1 },
      )),
    })),
  );
  const result = Object.fromEntries(results.map((r) => [r.entity, r.items]));
  const counts = Object.fromEntries(results.map((r) => [r.entity, r.total]));
  const facts = (result.provinces || []).filter(
    (p) =>
      typeof p.factSource === "string" && p.factSource.startsWith("https://"),
  );
  return { ...result, counts, facts };
}
export async function search(query: string, lang: "vi" | "en") {
  if (query.trim().length < 2) return [];
  const q = query.trim().slice(0, 100);
  const regex = escapeRegex(q);
  const groups = await Promise.all(
    (["provinces", "destinations", "specialties"] as const).map(
      async (entity) => {
        const base = await publicFilter(entity);
        const named = await listContent(
          entity,
          {
            ...base,
            $or: [
              { "name.vi": { $regex: regex, $options: "i" } },
              { "name.en": { $regex: regex, $options: "i" } },
            ],
          },
          0,
          6,
        );
        const text = await listContent(
          entity,
          { ...base, $text: { $search: q } },
          0,
          6,
        );
        const items = [
          ...new Map(
            [...named.items, ...text.items].map((item) => [
              String(item._id),
              item,
            ]),
          ).values(),
        ];
        return items.map((item) => ({
          title: item.name[lang] || item.name.vi,
          excerpt: (
            item.shortDescription?.[lang] ||
            item.shortDescription?.vi ||
            item.description?.[lang] ||
            item.description?.vi ||
            ""
          ).slice(0, 160),
          kind: entity,
          href: `/${entity === "provinces" ? "province" : entity === "destinations" ? "destination" : "specialty"}/${item.slug}`,
        }));
      },
    ),
  );
  const history = await models.provinces
    .find({
      ...(await publicFilter("provinces")),
      $or: [
        { "history.summary.vi": { $regex: regex, $options: "i" } },
        { "history.summary.en": { $regex: regex, $options: "i" } },
        { "history.events.title.vi": { $regex: regex, $options: "i" } },
      ],
    })
    .limit(4)
    .lean<RawContent[]>();
  return [
    ...groups.flat(),
    ...history.map((p) => ({
      title: p.name[lang] || p.name.vi,
      excerpt: p.history?.summary?.[lang] || p.history?.summary?.vi || "",
      kind: "history",
      href: `/province/${p.slug}#history`,
    })),
  ].slice(0, 22);
}
export async function randomDestination() {
  const [item] = await models.destinations.aggregate([
    { $match: await publicFilter("destinations") },
    { $sample: { size: 1 } },
  ]);
  if (!item) throw new AppError(404, "Chưa có địa danh được công bố.");
  return item;
}
