export type Locale = "vi" | "en";
export type Bilingual = { vi: string; en: string };
export const bi = (vi: string, en: string): Bilingual => ({ vi, en });
export const localeOf = (value: unknown): Locale =>
  value === "en" ? "en" : "vi";
export function translated(
  value: Partial<Bilingual> | undefined,
  locale: Locale,
): string {
  return (
    value?.[locale]?.trim() || value?.vi?.trim() || value?.en?.trim() || ""
  );
}
export function localize(value: unknown, locale: Locale): unknown {
  if (Array.isArray(value)) return value.map((item) => localize(item, locale));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("vi" in record || "en" in record)
      return translated(record as Partial<Bilingual>, locale);
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [
        key,
        localize(item, locale),
      ]),
    );
  }
  return value;
}
export const normalizeSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
