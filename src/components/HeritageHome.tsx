"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import { ArrowUpRight, Leaf } from "lucide-react";
import type { HomeBundle } from "../../shared/domain";
import { Header, Footer } from "./SiteChrome";
import { useLanguage } from "./LanguageProvider";
import HeroSlider from "./HeroSlider";
import ContentCard from "./ui/ContentCard";
import { imageOf } from "@/lib/content";
import Photo from "./ui/Photo";
import RandomDiscovery from "./discovery/RandomDiscovery";
import CommunityGallery from "./community/CommunityGallery";
import FeaturedDestinationCard from "./ui/FeaturedDestinationCard";
import SpecialtyMedia from "./ui/SpecialtyMedia";
import StickyHistoryStory from "./motion/StickyHistoryStory";
import { useHomeCinematicScenes } from "./motion/HomeCinematicScenes";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-loading">…</div>,
});

export default function HeritageHome({ data }: { data: HomeBundle }) {
  const { t, content } = useLanguage();
  const mainRef = useRef<HTMLElement>(null);

  useHomeCinematicScenes(mainRef);

  const pendingLabel = t("Đang cập nhật", "Updating");

  const points = useMemo(
    () =>
      data.destinations
        .filter((d) => d.location)
        .map((d) => ({
          id: d._id,
          name: content(d.name),
          lat: d.location!.coordinates[1],
          lng: d.location!.coordinates[0],
          href: `/destination/${d.slug}`,
          image: imageOf(d),
          description: content(d.shortDescription),
        })),
    [data, content],
  );

  return (
    <>
      <Header />
      <main id="main" className="cinematic-home" ref={mainRef}>
        {/* ================================================================
            SCENE 1: HERO (Fullscreen cinematic camera)
            ================================================================ */}
        <section className="scene hero" data-scene="hero">
          <div className="scene-pin">
            <div className="scene-stage hero-stage">
              <HeroSlider provinces={data.provinces} />
            </div>
          </div>
        </section>

        {/* ================================================================
            SCENE 2: INTRO / STORY
            ================================================================ */}
        <section className="scene intro" data-scene="intro" id="country">
          <div className="scene-pin">
            <div className="scene-stage intro-stage">
              <section className="intro-strip">
                <span className="intro-mark">✳</span>
                <p>
                  {t("Một đất nước để khám phá.", "A country to discover.")}
                  <br />
                  <strong>
                    {t("Một di sản để thấu hiểu.", "A heritage to understand.")}
                  </strong>
                </p>
                <div className="intro-divider" />
                <span className="intro-description">
                  {t(
                    "Từ những ngọn núi phương Bắc đến dòng sông phương Nam,",
                    "From northern mountains to southern waterways,",
                  )}
                  <br />
                  {t(
                    "mỗi miền đất là một chương trong câu chuyện Việt Nam.",
                    "each place is a chapter in the story of Vietnam.",
                  )}
                </span>
                <span className="nonprofit">
                  <Leaf size={19} />
                  {t(
                    "Tri thức mở. Hoàn toàn phi thương mại.",
                    "Open knowledge. Always non-commercial.",
                  )}
                </span>
              </section>

              <section className="section-wrap country-overview">
                <div>
                  <div className="eyebrow">
                    {t(
                      "VIỆT NAM, TỪNG LỚP KHÁM PHÁ",
                      "VIETNAM, LAYER BY LAYER",
                    )}
                  </div>
                  <h2>
                    {t("Những miền đất.", "Places and people.")}
                    <br />
                    <em>{t("Những điều ở lại.", "Stories that stay.")}</em>
                  </h2>
                </div>
                <div>
                  <p>
                    {t(
                      "Địa lý mở ra cảnh quan. Lịch sử lưu giữ ký ức. Văn hóa và ẩm thực kết nối con người. Cùng tìm hiểu Việt Nam qua những hồ sơ được tổ chức rõ ràng và góc nhìn từ cộng đồng.",
                      "Geography reveals landscapes. History preserves memories. Culture and food connect people. Explore Vietnam through structured profiles and community perspectives.",
                    )}
                  </p>
                  <div className="stats-strip">
                    <span>
                      <strong>{data.counts.provinces}</strong>
                      {t("tỉnh thành đã giới thiệu", "province profiles")}
                    </span>
                    <span>
                      <strong
                        className={
                          data.counts.destinations ? undefined : "is-pending"
                        }
                      >
                        {data.counts.destinations || pendingLabel}
                      </strong>
                      {t("địa danh khám phá", "destinations")}
                    </span>
                    <span>
                      <strong
                        className={
                          data.counts.specialties ? undefined : "is-pending"
                        }
                      >
                        {data.counts.specialties || pendingLabel}
                      </strong>
                      {t("hương vị địa phương", "local flavours")}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>

        {/* ================================================================
            SCENE 3: REGIONAL CARDS
            ================================================================ */}
        <section className="scene regions" data-scene="regions">
          <div className="scene-pin">
            <div className="scene-stage regions-stage">
              <div className="regions-ambient-glow" />
              <div className="region-heading">
                <div className="eyebrow light">
                  {t("BA MIỀN. MỘT VIỆT NAM.", "THREE REGIONS. ONE VIETNAM.")}
                </div>
                <h2 className="stage-title">
                  {t("Những sắc thái", "Many shades of")}{" "}
                  <em>{t("của một quê hương.", "one homeland.")}</em>
                </h2>
                <div className="scene-rail-status" aria-hidden="true">
                  <span className="region-current">01</span>
                  <span className="scene-progress">
                    <span />
                  </span>
                  <span>{String(data.regions.length).padStart(2, "0")}</span>
                </div>
              </div>

              <div className="region-scene-viewport">
                <div className="region-panels">
                  {data.regions.map((region, index) => (
                    <div
                      className="region-slide"
                      key={region._id}
                      data-index={index}
                    >
                      <Link
                        className="region-panel"
                        href={`/explore?regionId=${region._id}`}
                      >
                        <span className="region-image-motion">
                          <Photo
                            src={imageOf(region)}
                            alt={content(region.name)}
                            fill
                            sizes="(min-width: 1024px) 72vw, 100vw"
                          />
                        </span>
                        <span className="region-panel-overlay" />
                        <span className="region-panel-copy">
                          <small>0{index + 1}</small>
                          <strong>{content(region.name)}</strong>
                          <span>
                            {t("Bắt đầu hành trình", "Begin the journey")}{" "}
                            <ArrowUpRight size={16} />
                          </span>
                        </span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            SCENE 4: DESTINATION GALLERY
            ================================================================ */}
        <section
          className={`scene gallery${data.destinations.length ? "" : " is-empty"}`}
          data-scene="gallery"
        >
          <div className="scene-pin">
            <div className="scene-stage gallery-stage">
              <div className="gallery-heading">
                <div>
                  <div className="eyebrow">
                    {t("BA MIỀN, NHIỀU SẮC THÁI", "REGIONS, MANY PERSPECTIVES")}
                  </div>
                  <h2>
                    {t("Khám phá", "Discover")}{" "}
                    <em>{t("vùng miền.", "the regions.")}</em>
                  </h2>
                </div>
                <Link href="/explore" className="text-link">
                  {t("Tất cả địa phương", "All provinces")}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              {data.destinations.length > 0 && (
                <div className="editorial-gallery">
                  {data.destinations.slice(0, 3).map((p, index) => (
                    <div
                      className={`gallery-layer gallery-layer-${index + 1}`}
                      key={p._id}
                    >
                      <div className="gallery-image-motion">
                        <FeaturedDestinationCard item={p} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================
            SCENE 5: MAP
            ================================================================ */}
        <section className="scene map" data-scene="map" id="atlas">
          <div className="scene-pin">
            <div className="scene-stage map-stage">
              <div className="map-intro">
                <div className="map-intro-copy">
                  <div className="eyebrow">
                    {t("BẢN ĐỒ KHÁM PHÁ", "THE DISCOVERY ATLAS")}
                  </div>
                  <h2>
                    {t("Việt Nam,", "Vietnam,")}{" "}
                    <em>{t("từng lớp địa hình.", "layer by layer.")}</em>
                  </h2>
                  <p>
                    {t(
                      "Theo dõi những câu chuyện địa phương từ miền núi, đồng bằng đến dải bờ biển Việt Nam.",
                      "Follow local stories from mountain ranges and deltas to Vietnam's long coastline.",
                    )}
                  </p>
                </div>
                <div className="map-intro-meta">
                  <div className="map-stat">
                    <strong>{data.counts.provinces}</strong>
                    <span>{t("tỉnh thành", "province profiles")}</span>
                  </div>
                  <div className="map-stat">
                    <strong>{data.regions.length}</strong>
                    <span>{t("vùng miền", "regions")}</span>
                  </div>
                  <Link className="map-atlas-link" href="/map">
                    {t("Mở bản đồ đầy đủ", "Open full atlas")}
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              </div>
              <div className="map-frame">
                <div className="map-camera">
                  <MapView places={points} />
                </div>
                <div className="map-frame-shade" aria-hidden="true" />
                <div className="map-location-label">
                  <span>{t("TÂM BẢN ĐỒ", "MAP CENTRE")}</span>
                  <strong>
                    {t("16.15° B · 107.8° Đ", "16.15° N · 107.8° E")}
                  </strong>
                </div>
                <p className="map-note">
                  {t(
                    "Kéo để di chuyển · dùng +/− để thu phóng",
                    "Drag to move · use +/− to zoom",
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            SCENE 6: LOCAL MEMORY
            ================================================================ */}
        <section className="scene memories" data-scene="memories">
          <div className="scene-pin">
            <div className="scene-stage memories-stage">
              <StickyHistoryStory item={data.provinces[0]} />
            </div>
          </div>
        </section>

        {/* ================================================================
            SCENE 7: CULTURE / FOOD
            ================================================================ */}
        {data.specialties.length > 0 && (
          <section className="scene culture" data-scene="culture">
            <div className="scene-pin">
              <div className="scene-stage culture-stage">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">
                      {t("HƯƠNG VỊ & KÝ ỨC", "FLAVOUR & MEMORY")}
                    </div>
                    <h2>
                      {t("Một chút", "A taste of")}{" "}
                      <em>{t("quê hương.", "belonging.")}</em>
                    </h2>
                  </div>
                  <Link href="/specialties" className="text-link">
                    {t("Khám phá đặc sản", "Explore flavours")} ↗
                  </Link>
                </div>
                <div className="culture-deck-stage">
                  {data.specialties[0] && (
                    <div className="culture-deck-card culture-deck-card-0 food-feature">
                      <div className="food-media">
                        <SpecialtyMedia item={data.specialties[0]} />
                      </div>
                      <div className="food-copy" data-lenis-prevent>
                        <div className="eyebrow">
                          {t(
                            "MỘT MÓN ĂN, MỘT CÂU CHUYỆN",
                            "ONE DISH, ONE STORY",
                          )}
                        </div>
                        <h3>{content(data.specialties[0].name)}</h3>
                        <p>
                          {content(
                            data.specialties[0].description ||
                              data.specialties[0].culturalStory,
                          )}
                        </p>
                        <Link
                          className="text-link"
                          href={`/specialty/${data.specialties[0].slug}`}
                        >
                          {t("Đọc câu chuyện", "Read the story")}{" "}
                          <ArrowUpRight size={16} />
                        </Link>
                      </div>
                    </div>
                  )}
                  {data.specialties.slice(1, 3).map((p, index) => (
                    <div
                      className={`culture-deck-card culture-deck-card-${index + 1}`}
                      data-lenis-prevent
                      key={p._id}
                    >
                      <ContentCard item={p} kind="specialty" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            SCENE 8: OUTRO / COMMUNITY & EDITORIAL DISCOVERY
            ================================================================ */}
        <section className="scene outro" data-scene="outro" id="community">
          <div className="scene-stage outro-stage">
            <div className="section-wrap fact-section">
              <div className="eyebrow">
                {t("BẠN CÓ BIẾT?", "DID YOU KNOW?")}
              </div>
              {data.facts[0] ? (
                <>
                  <h3>{content(data.facts[0].fact)}</h3>
                  <a
                    href={data.facts[0].factSource}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Đọc nguồn tư liệu", "Read the source")} ↗
                  </a>
                </>
              ) : (
                <>
                  <h3>
                    {t(
                      "Một câu hỏi hay là khởi đầu của khám phá.",
                      "A good question is the beginning of discovery.",
                    )}
                  </h3>
                  <p>
                    {t(
                      "Những câu chuyện ngắn sẽ xuất hiện ở đây sau khi ban biên tập xác minh nguồn.",
                      "Short facts will appear here once their sources have been verified by the editors.",
                    )}
                  </p>
                </>
              )}
            </div>

            <div className="community-wrap">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    {t(
                      "VIỆT NAM QUA GÓC NHÌN CỦA BẠN",
                      "VIETNAM THROUGH YOUR EYES",
                    )}
                  </div>
                  <h2>
                    {t("Khoảnh khắc", "Moments,")}{" "}
                    <em>{t("được sẻ chia.", "shared.")}</em>
                  </h2>
                </div>
                <Link href="/community" className="text-link">
                  {t("Không gian cộng đồng", "Community space")} ↗
                </Link>
              </div>
              <CommunityGallery compact />
            </div>

            <RandomDiscovery />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
