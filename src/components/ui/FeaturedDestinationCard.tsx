"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Content } from "../../../shared/domain";
import { useLanguage } from "../LanguageProvider";
import { imageOf, related } from "@/lib/content";
import Photo from "./Photo";
export default function FeaturedDestinationCard({ item }: { item: Content }) {
  const { content, t } = useLanguage();
  return <Link className="featured-destination" href={`/destination/${item.slug}`}>
    <Photo src={imageOf(item)} alt={content(item.name)} fill sizes="(max-width: 650px) 100vw, 60vw" />
    <div className="featured-destination-copy">
      <small>{content(related(item.provinceId)?.name) || t("ĐỊA DANH VIỆT NAM", "PLACES OF VIETNAM")}{item.isSample ? t(" · Hồ sơ mẫu", " · Sample profile") : ""}</small>
      <h3>{content(item.name)}</h3><ArrowUpRight size={24} />
    </div>
  </Link>;
}
