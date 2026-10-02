import type { Content, Text } from "../../shared/domain";
export function text(value: Text | undefined, locale: "vi" | "en" = "vi") {
  if (typeof value === "string") return value;
  return (locale === "en" && value?.en) || value?.vi || value?.en || "";
}
export const related = (
  value: Content | string | undefined,
): Content | undefined =>
  value && typeof value === "object" ? value : undefined;
export const imageOf = (item: Content) =>
  item.heroImage || item.images?.[0] || "/images/image-placeholder.svg";
