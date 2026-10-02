"use client";
import type { Content } from "../../../shared/domain";
import { imageOf } from "@/lib/content";
import { useLanguage } from "../LanguageProvider";
import Photo from "./Photo";
export default function SpecialtyMedia({ item }: { item: Content }) {
  const { t, content } = useLanguage();
  const src = imageOf(item);
  if (!src || src.includes("placeholder")) return <div className="specialty-fallback">
    <span>{t("HƯƠNG VỊ & KÝ ỨC", "FLAVOUR & MEMORY")}</span>
    <strong>{content(item.name)}</strong>
    <small>{t("Tư liệu mẫu · Ảnh món ăn đang được bổ sung", "Sample profile · Food photography coming soon")}</small>
  </div>;
  return <Photo src={src} alt={content(item.name)} />;
}
