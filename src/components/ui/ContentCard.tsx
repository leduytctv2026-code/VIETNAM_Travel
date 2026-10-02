"use client";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { Content } from "../../../shared/domain";
import { useLanguage } from "../LanguageProvider";
import { imageOf, related } from "@/lib/content";
import Photo from "./Photo";
import SpecialtyMedia from "./SpecialtyMedia";
export default function ContentCard({
  item,
  kind = "destination",
  className = "",
}: {
  item: Content;
  kind?: "province" | "destination" | "specialty";
  className?: string;
}) {
  const { t, content } = useLanguage();
  return (
    <article className={`place-card ${kind}-card ${className}`.trim()}>
      <Link className="card-image" href={`/${kind}/${item.slug}`}>
        {kind === "specialty" ? <SpecialtyMedia item={item} /> : <Photo src={imageOf(item)} alt={content(item.name)} />}
        {item.isSample && (
          <span className="card-tag">{t("Hồ sơ mẫu", "Sample profile")}</span>
        )}
        <span className="card-open">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="card-meta">
        {content(related(item.provinceId)?.name) ||
          content(related(item.regionId)?.name) ||
          t("DI SẢN VIỆT NAM", "VIETNAM HERITAGE")}
      </div>
      <Link className="card-title" href={`/${kind}/${item.slug}`}>
        <h3>{content(item.name)}</h3>
      </Link>
      <p>
        {content(item.shortDescription || item.description || item.overview)}
      </p>
      {typeof item.distanceKm === "number" && (
        <p className="card-location">
          <MapPin size={12} />
          {item.distanceKm} km
        </p>
      )}
    </article>
  );
}
