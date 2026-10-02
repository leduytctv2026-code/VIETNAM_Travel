import type { MetadataRoute } from "next";
import { serverOrigin, serverRequest } from "@/lib/server-content";
import type { Content } from "../../shared/domain";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.FRONTEND_URL || (await serverOrigin());
  const items: MetadataRoute.Sitemap = [
    "",
    "/explore",
    "/destinations",
    "/specialties",
    "/map",
    "/community",
  ].map((path) => ({ url: base + path }));
  for (const [entity, route] of [
    ["provinces", "province"],
    ["destinations", "destination"],
    ["specialties", "specialty"],
  ]) {
    let page = 1;
    let pages: number;
    do {
      const response = await serverRequest<Content[]>(
        `/${entity}?page=${page}&limit=100`,
      );
      pages = response.pagination?.pages || 1;
      for (const item of response.data)
        if (!item.isSample)
          items.push({
            url: `${base}/${route}/${item.slug}`,
            lastModified: item.updatedAt,
          });
      page++;
    } while (page <= pages);
  }
  return items;
}
