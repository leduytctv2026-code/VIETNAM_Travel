"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import { motion, useScroll } from "framer-motion";
import Link from "next/link";
import type { Content } from "../../../shared/domain";
import { Header, Footer, Breadcrumbs, SampleNote } from "../SiteChrome";
import { useLanguage } from "../LanguageProvider";
import Photo from "../ui/Photo";
import SpecialtyMedia from "../ui/SpecialtyMedia";
import ContentCard from "../ui/ContentCard";
import { imageOf, related } from "@/lib/content";
import Timeline from "../motion/Timeline";
import { useHydratedReducedMotion } from "../motion/useHydratedReducedMotion";
import CommunityGallery from "../community/CommunityGallery";
import Discussion from "../community/Discussion";
const MapView = dynamic(() => import("../MapView"), {
  ssr: false,
  loading: () => <div className="map-loading">…</div>,
});
export default function DetailPage({
  item,
  relatedItems,
  kind,
}: {
  item: Content;
  relatedItems: Content[];
  kind: "destination" | "specialty";
}) {
  const { content, t, locale } = useLanguage();
  const province = related(item.provinceId);
  const region = related(province?.regionId);
  const ref = useRef<HTMLElement>(null);
  const reduced = useHydratedReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const points = useMemo(
    () =>
      item.location
        ? [
            {
              id: item._id,
              name: content(item.name),
              lng: item.location.coordinates[0],
              lat: item.location.coordinates[1],
            },
          ]
        : [],
    [item, locale],
  );
  return (
    <>
      <Header />
      <main id="main" ref={ref} className={`${kind}-detail`}>
        {!reduced && (
          <motion.div
            className="reading-progress"
            aria-hidden="true"
            style={{ scaleX: scrollYProgress }}
          />
        )}
        <section className="province-hero">
          {kind === "specialty" && imageOf(item).includes("placeholder") ? (
            <SpecialtyMedia item={item} />
          ) : (
            <Photo
              src={imageOf(item)}
              alt={content(item.name)}
              fill
              priority
              sizes="100vw"
              className="hero-image"
            />
          )}
          <div className="hero-shade" />
          <div className="province-hero-copy">
            <div className="eyebrow light">
              {content(province?.name)} ·{" "}
              {kind === "destination"
                ? t("ĐỊA DANH VIỆT NAM", "VIETNAM DESTINATIONS")
                : t("ĐẶC SẢN ĐỊA PHƯƠNG", "LOCAL SPECIALTIES")}
            </div>
            <h1>{content(item.name)}</h1>
            <p>{content(item.shortDescription)}</p>
          </div>
        </section>
        <div className="section-wrap">
          <Breadcrumbs
            items={[
              ...(region
                ? [
                    {
                      label: content(region.name),
                      href: `/explore?regionId=${region._id}`,
                    },
                  ]
                : []),
              ...(province
                ? [
                    {
                      label: content(province.name),
                      href: `/province/${province.slug}`,
                    },
                  ]
                : []),
              { label: content(item.name) },
            ]}
          />
          {item.isSample && <SampleNote />}
          <section className="detail-section editorial-section">
            <div>
              <div className="eyebrow">
                {t("CÂU CHUYỆN NƠI CHỐN", "A STORY OF PLACE")}
              </div>
              <h2>
                {t("Tìm hiểu", "Understand")}
                <br />
                <em>{content(item.name)}.</em>
              </h2>
            </div>
            <div className="reading-copy">
              <p className="lead-copy">{content(item.description)}</p>
              {content(item.culturalValue) && (
                <>
                  <h3>{t("Giá trị văn hóa", "Cultural value")}</h3>
                  <p>{content(item.culturalValue)}</p>
                </>
              )}
            </div>
          </section>
          {kind === "destination" ? (
            <>
              <section className="detail-section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">
                      {t("KÝ ỨC & TƯ LIỆU", "MEMORY & ARCHIVES")}
                    </div>
                    <h2>
                      {t("Câu chuyện", "The story")}{" "}
                      <em>{t("lịch sử.", "through time.")}</em>
                    </h2>
                  </div>
                </div>
                <p className="lead-copy">{content(item.history?.summary)}</p>
                <Timeline events={item.history?.events || []} />
              </section>
              <section className="detail-section">
                <h2>
                  {t("Vị trí", "Location")}{" "}
                  <em>{t("& cảnh quan.", "& landscape.")}</em>
                </h2>
                <p className="lead-copy">
                  {content(item.geography?.description)}
                </p>
                <p className="coordinate-label">
                  {content(item.address)} · {item.location?.coordinates[1]}° N,{" "}
                  {item.location?.coordinates[0]}° E
                </p>
                <MapView places={points} />
                <Link
                  className="text-link"
                  href={`/map?destination=${item._id}`}
                >
                  {t("Khám phá bản đồ", "Explore the map")} ↗
                </Link>
              </section>
              <section className="detail-section">
                <h2>
                  {t("Bộ sưu tập", "Official")}{" "}
                  <em>{t("hình ảnh.", "gallery.")}</em>
                </h2>
                <div className="official-gallery">
                  {item.officialGallery?.map((src, i) => (
                    <Photo
                      key={src + i}
                      src={src}
                      alt={`${content(item.name)} — ${i + 1}`}
                    />
                  ))}
                </div>
                {!item.officialGallery?.length && (
                  <p className="empty-copy">
                    {t(
                      "Những góc nhìn chính thức đang được tuyển chọn.",
                      "Official images are being curated.",
                    )}
                  </p>
                )}
              </section>
              <section className="detail-section" id="community">
                <h2>
                  {t("Khoảnh khắc", "Community")}{" "}
                  <em>{t("cộng đồng.", "moments.")}</em>
                </h2>
                <CommunityGallery destination={item} />
              </section>
              <section className="detail-section" id="discussion">
                <h2>
                  {t("Cùng nhau", "A shared")}{" "}
                  <em>{t("trò chuyện.", "conversation.")}</em>
                </h2>
                <Discussion destinationId={item._id} />
              </section>
            </>
          ) : (
            <>
              {[
                ["origin", "Nguồn gốc", "Origins"],
                ["culturalStory", "Câu chuyện văn hóa", "Cultural story"],
                [
                  "characteristics",
                  "Thành phần & đặc trưng",
                  "Ingredients & characteristics",
                ],
                ["servingGuide", "Cách thưởng thức", "Serving guide"],
              ].map(([key, vi, en]) => (
                <section className="detail-section editorial-section" key={key}>
                  <h2>{t(vi, en)}</h2>
                  <p className="lead-copy">
                    {content(
                      item[
                        key as
                          | "origin"
                          | "culturalStory"
                          | "characteristics"
                          | "servingGuide"
                      ],
                    ) ||
                      t(
                        "Nội dung đang được biên tập.",
                        "Content is being edited.",
                      )}
                  </p>
                </section>
              ))}
              <div className="official-gallery">
                {item.images?.slice(1).map((src, i) => (
                  <Photo key={src + i} src={src} alt={content(item.name)} />
                ))}
              </div>
            </>
          )}
          <aside className="sources">
            {item.sources?.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title} ↗
              </a>
            ))}
          </aside>
          <section className="detail-section">
            <div className="section-heading">
              <h2>
                {kind === "destination"
                  ? t("Địa danh gần đây.", "Nearby discoveries.")
                  : t("Hương vị khác.", "More local flavours.")}
              </h2>
              <Link
                className="text-link"
                href={kind === "destination" ? "/destinations" : "/specialties"}
              >
                {t("Khám phá tiếp", "Keep exploring")} ↗
              </Link>
            </div>
            <div className="place-grid">
              {relatedItems.map((relatedItem) => (
                <ContentCard
                  key={relatedItem._id}
                  item={relatedItem}
                  kind={kind}
                />
              ))}
            </div>
            {!relatedItems.length && (
              <p className="empty-copy">
                {t(
                  "Mở danh mục để tìm thêm một câu chuyện.",
                  "Open the directory to find another story.",
                )}
              </p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
