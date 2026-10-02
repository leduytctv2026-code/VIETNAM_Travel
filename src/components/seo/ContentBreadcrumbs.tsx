import type { Content } from "../../../shared/domain";
import { text, related } from "@/lib/content";

export default function ContentBreadcrumbs({
  item,
  kind,
}: {
  item: Content;
  kind: "province" | "destination" | "specialty";
}) {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
  const province = kind === "province" ? undefined : related(item.provinceId);
  const region = related((province || item).regionId);
  const entries = [
    { name: "Việt Nam · Vietnam", path: "/" },
    ...(region
      ? [{ name: text(region.name), path: `/explore?regionId=${region._id}` }]
      : []),
    ...(province
      ? [{ name: text(province.name), path: `/province/${province.slug}` }]
      : []),
    { name: text(item.name), path: `/${kind}/${item.slug}` },
  ];
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: new URL(entry.path, base).href,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
