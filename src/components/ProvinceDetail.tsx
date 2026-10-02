"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { ProvinceBundle } from "../../shared/domain";
import { Header, Footer, Breadcrumbs, SampleNote } from "./SiteChrome";
import { useLanguage } from "./LanguageProvider";
import { imageOf, related } from "@/lib/content";
import Photo from "./ui/Photo";
import ContentCard from "./ui/ContentCard";
import Timeline from "./motion/Timeline";
import BeforeAfter from "./motion/BeforeAfter";
import RandomDiscovery from "./discovery/RandomDiscovery";
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-loading">…</div>,
});
const tabs = [
  ["overview", "Tổng quan", "Overview"],
  ["history", "Lịch sử", "History"],
  ["geography", "Địa lý", "Geography"],
  ["specialties", "Đặc sản", "Specialties"],
  ["attractions", "Địa danh", "Attractions"],
];
export default function ProvinceDetail({ data }: { data: ProvinceBundle }) {
  const { province: p, destinations, specialties } = data;
  const { t, content, locale } = useLanguage();
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    function sync() {
      const id = location.hash.slice(1);
      if (tabs.some((x) => x[0] === id)) setTab(id);
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const points = useMemo(
    () =>
      p.coordinates
        ? [
            {
              id: p._id,
              name: content(p.name),
              lng: p.coordinates.coordinates[0],
              lat: p.coordinates.coordinates[1],
            },
          ]
        : [],
    [p, locale],
  );
  function choose(id: string) {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  }
  return (
    <>
      <Header />
      <main id="main">
        <section className="province-hero">
          <Photo
            src={imageOf(p)}
            alt={content(p.name)}
            fill
            priority
            sizes="100vw"
            className="hero-image"
          />
          <div className="hero-shade" />
          <div className="province-hero-copy">
            <div className="eyebrow light">
              {content(related(p.regionId)?.name)}
            </div>
            <h1>{content(p.name)}</h1>
            <p>{content(p.shortDescription)}</p>
          </div>
        </section>
        <div className="section-wrap">
          <Breadcrumbs
            items={[
              {
                label: content(related(p.regionId)?.name),
                href: `/explore?regionId=${related(p.regionId)?._id || ""}`,
              },
              { label: content(p.name) },
            ]}
          />
          {p.isSample && <SampleNote />}
          <div
            className="province-tabs"
            role="tablist"
            aria-label={t("Nội dung tỉnh thành", "Province sections")}
          >
            {tabs.map(([id, vi, en], i) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-controls={`panel-${id}`}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => choose(id)}
                onKeyDown={(e) => {
                  let next: number;
                  if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
                  else if (e.key === "ArrowLeft")
                    next = (i + tabs.length - 1) % tabs.length;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = tabs.length - 1;
                  else return;
                  e.preventDefault();
                  choose(tabs[next][0]);
                  document.getElementById(`tab-${tabs[next][0]}`)?.focus();
                }}
              >
                <span aria-hidden="true">0{i + 1}</span>
                {t(vi, en)}
              </button>
            ))}
          </div>
          <motion.section
            key={tab}
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
            className="province-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {tab === "overview" && (
              <div className="editorial-section">
                <div>
                  <div className="eyebrow">
                    01 / {t("TỔNG QUAN", "OVERVIEW")}
                  </div>
                  <h2>
                    {t("Gặp gỡ", "Meet")}
                    <br />
                    <em>{content(p.name)}.</em>
                  </h2>
                </div>
                <div className="reading-copy">
                  <p className="lead-copy">{content(p.overview)}</p>
                  {content(p.culture) && (
                    <>
                      <h3>{t("Văn hóa & bản sắc", "Culture & identity")}</h3>
                      <p>{content(p.culture)}</p>
                    </>
                  )}
                  {content(p.people) && (
                    <>
                      <h3>{t("Con người", "People")}</h3>
                      <p>{content(p.people)}</p>
                    </>
                  )}
                </div>
              </div>
            )}
            {tab === "history" && (
              <div className="history-layout">
                <div>
                  <div className="eyebrow">02 / {t("LỊCH SỬ", "HISTORY")}</div>
                  <h2>
                    {t("Những lớp", "Layers of")}
                    <br />
                    <em>{t("thời gian.", "time.")}</em>
                  </h2>
                  <p className="lead-copy">{content(p.history?.summary)}</p>
                </div>
                <div>
                  <Timeline events={p.history?.events || []} />
                  {p.history?.beforeImage && p.history.afterImage && (
                    <BeforeAfter
                      before={p.history.beforeImage}
                      after={p.history.afterImage}
                    />
                  )}
                </div>
              </div>
            )}
            {tab === "geography" && (
              <>
                <div className="editorial-section">
                  <div>
                    <div className="eyebrow">
                      03 / {t("ĐỊA LÝ", "GEOGRAPHY")}
                    </div>
                    <h2>
                      {t("Vị trí", "Setting")}
                      <br />
                      <em>{t("& địa hình.", "& terrain.")}</em>
                    </h2>
                  </div>
                  <div className="reading-copy">
                    <p>{content(p.geography?.description)}</p>
                    {[
                      ["terrain", "Địa hình", "Terrain"],
                      ["climate", "Khí hậu", "Climate"],
                      ["boundaries", "Ranh giới", "Boundaries"],
                    ].map(([key, vi, en]) => {
                      const value =
                        p.geography?.[
                          key as "terrain" | "climate" | "boundaries"
                        ];
                      return content(value) ? (
                        <section key={key}>
                          <h3>{t(vi, en)}</h3>
                          <p>{content(value)}</p>
                        </section>
                      ) : null;
                    })}
                    {p.geography?.areaKm2 != null && (
                      <p>
                        {t("Diện tích", "Area")}: {p.geography.areaKm2} km²
                      </p>
                    )}
                    {p.coordinates && (
                      <p className="coordinate-label">
                        {p.coordinates.coordinates[1]}° N ·{" "}
                        {p.coordinates.coordinates[0]}° E
                      </p>
                    )}
                  </div>
                </div>
                <MapView places={points} />
              </>
            )}
            {tab === "specialties" && (
              <>
                <div className="eyebrow">
                  04 / {t("ĐẶC SẢN", "SPECIALTIES")}
                </div>
                <h2>
                  {t("Hương vị", "A taste of")}{" "}
                  <em>{t("địa phương.", "place.")}</em>
                </h2>
                <div className="specialty-grid">
                  {specialties.map((item) => (
                    <ContentCard key={item._id} item={item} kind="specialty" />
                  ))}
                </div>
                {!specialties.length && (
                  <Empty
                    text={t(
                      "Những hương vị đang chờ được kể.",
                      "Flavours waiting to be explored.",
                    )}
                  />
                )}
              </>
            )}
            {tab === "attractions" && (
              <>
                <div className="eyebrow">
                  05 / {t("ĐỊA DANH", "DESTINATIONS")}
                </div>
                <h2>
                  {t("Đi tiếp", "Discover")}{" "}
                  <em>{t("một câu chuyện.", "another story.")}</em>
                </h2>
                <div className="attraction-grid">
                  {destinations.map((item) => (
                    <ContentCard item={item} key={item._id} />
                  ))}
                </div>
                {!destinations.length && (
                  <Empty
                    text={t(
                      "Những nơi chốn đang chờ được giới thiệu.",
                      "Places waiting to be introduced.",
                    )}
                  />
                )}
              </>
            )}
          </motion.section>
          <aside className="sources">
            <strong>{t("Nguồn tham khảo", "References")}</strong>
            {p.sources?.map((s) => (
              <a href={s.url} target="_blank" rel="noreferrer" key={s.url}>
                {s.title} ↗
              </a>
            ))}
          </aside>
        </div>
        <RandomDiscovery />
      </main>
      <Footer />
    </>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="section-empty">
      <h3>{text}</h3>
    </div>
  );
}
