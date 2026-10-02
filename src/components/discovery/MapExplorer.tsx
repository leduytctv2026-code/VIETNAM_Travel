"use client";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Content, Pagination } from "../../../shared/domain";
import { api, request } from "@/services/api";
import { Header, Footer } from "../SiteChrome";
import { useLanguage } from "../LanguageProvider";
import { imageOf } from "@/lib/content";
import Photo from "../ui/Photo";
const MapView = dynamic(() => import("../MapView"), {
  ssr: false,
  loading: () => <div className="map-loading">…</div>,
});
export default function MapExplorer() {
  const params = useSearchParams();
  const { t, content, locale } = useLanguage();
  const [province, setProvince] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Content[]>([]);
  const [provinces, setProvinces] = useState<Content[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>();
  const [focus, setFocus] = useState(params?.get("destination") || "");
  const [error, setError] = useState("");
  const [resultsOpen, setResultsOpen] = useState(true);
  useEffect(() => {
    api<Content[]>("/provinces?limit=100", {}, locale)
      .then(setProvinces)
      .catch(() => {});
  }, [locale]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        request<Content[]>(
          `/destinations?limit=100&page=${page}&q=${encodeURIComponent(query)}${province ? `&provinceId=${province}` : ""}${category ? `&category=${category}` : ""}`,
          { signal: controller.signal },
          locale,
        )
          .then((result) => {
            setItems(result.data);
            setPagination(result.pagination);
            setError("");
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setError(
                t("Chưa thể tải dữ liệu bản đồ.", "Unable to load map data."),
              );
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [province, category, query, page, locale]);
  const points = useMemo(
    () =>
      items
        .filter((p) => p.location)
        .map((p) => ({
          id: p._id,
          name: content(p.name),
          lat: p.location!.coordinates[1],
          lng: p.location!.coordinates[0],
          href: `/destination/${p.slug}`,
          image: imageOf(p),
          description: content(p.shortDescription),
        })),
    [items, locale],
  );
  return (
    <>
      <Header />
      <main id="main" className="map-page">
        <div className="map-title">
          <div className="eyebrow">
            {t("BẢN ĐỒ KHÁM PHÁ", "THE LIVING ATLAS")}
          </div>
          <h1>
            {t("Mỗi điểm chạm, một câu chuyện.", "Every point, a story.")}
          </h1>
        </div>
        <div className="map-workspace">
          <button className="map-results-toggle" aria-expanded={resultsOpen} aria-controls="map-results" onClick={() => setResultsOpen(!resultsOpen)}>{resultsOpen ? t("Thu gọn kết quả", "Collapse results") : t("Hiện kết quả", "Show results")} · {pagination?.total || 0}</button>
          <aside id="map-results" className={`map-sidebar${resultsOpen ? "" : " is-collapsed"}`}>
            <label>
              {t("Tìm địa danh", "Search places")}
              <input
                value={query}
                placeholder={t("Một tên gọi…", "A place name…")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              {t("Tỉnh thành", "Province")}
              <select
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">
                  {t("Tất cả tỉnh thành", "All provinces")}
                </option>
                {provinces.map((p) => (
                  <option value={p._id} key={p._id}>
                    {content(p.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Loại địa danh", "Category")}
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">
                  {t("Tất cả loại hình", "All categories")}
                </option>
                {[
                  ["nature", "Thiên nhiên", "Nature"],
                  ["heritage", "Di sản", "Heritage"],
                  ["culture", "Văn hóa", "Culture"],
                  ["museum", "Bảo tàng", "Museum"],
                ].map(([v, vi, en]) => (
                  <option value={v} key={v}>
                    {t(vi, en)}
                  </option>
                ))}
              </select>
            </label>
            <p className="result-count">
              {pagination?.total || 0} {t("địa danh", "places")}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="map-list">
              {items.map((item) => (
                <article
                  key={item._id}
                  className={focus === item._id ? "active" : ""}
                >
                  <Photo src={imageOf(item)} alt={content(item.name)} />
                  <div>
                    <button onClick={() => setFocus(item._id)}>
                      {content(item.name)}
                    </button>
                    <Link href={`/destination/${item.slug}`}>
                      {t("Khám phá", "Discover")} ↗
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {!items.length && !error && (
              <p className="empty-copy">
                {t(
                  "Thử thay đổi từ khóa hoặc bộ lọc.",
                  "Try another keyword or filter.",
                )}
              </p>
            )}
            {(pagination?.pages || 0) > 1 && (
              <div className="pagination">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ←
                </button>
                <span>
                  {page}/{pagination?.pages}
                </span>
                <button
                  disabled={page === pagination?.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            )}
          </aside>
          <MapView places={points} focusId={focus} />
        </div>
      </main>
      <Footer />
    </>
  );
}
