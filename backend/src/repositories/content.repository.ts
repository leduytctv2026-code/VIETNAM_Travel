import { models, type ContentCollection } from "../models/index.ts";
import type { FilterQuery } from "mongoose";
export type RawContent = {
  _id: string;
  slug: string;
  name: { vi: string; en?: string };
  status: string;
  regionId?: RawContent | string;
  provinceId?: RawContent | string;
  description?: { vi: string; en?: string };
  overview?: { vi: string; en?: string };
  shortDescription?: { vi: string; en?: string };
  history?: { summary?: { vi: string; en?: string } };
  location?: { type: "Point"; coordinates: [number, number] };
  [key: string]: unknown;
};
export const published = { status: "published", deletedAt: null };
export async function publicFilter(
  entity: ContentCollection,
): Promise<FilterQuery<RawContent>> {
  if (entity === "regions") return { ...published };
  const regions = await models.regions.find(published).distinct("_id");
  if (entity === "provinces")
    return { ...published, regionId: { $in: regions } };
  const provinces = await models.provinces
    .find({ ...published, regionId: { $in: regions } })
    .distinct("_id");
  return { ...published, provinceId: { $in: provinces } };
}
export async function listContent(
  entity: ContentCollection,
  filter: FilterQuery<RawContent>,
  skip = 0,
  limit = 12,
  sort: Record<string, 1 | -1> = { "name.vi": 1 },
) {
  const query = models[entity].find(filter).sort(sort).skip(skip).limit(limit);
  if (entity === "provinces") query.populate("regionId");
  if (entity === "destinations" || entity === "specialties")
    query.populate({ path: "provinceId", populate: { path: "regionId" } });
  return {
    items: await query.lean<RawContent[]>(),
    total: await models[entity].countDocuments(filter),
  };
}
export async function findContent(entity: ContentCollection, slug: string) {
  const query = models[entity].findOne({
    ...(await publicFilter(entity)),
    slug,
  });
  if (entity === "provinces") query.populate("regionId");
  if (entity === "destinations" || entity === "specialties")
    query.populate({ path: "provinceId", populate: { path: "regionId" } });
  return query.lean<RawContent>();
}
