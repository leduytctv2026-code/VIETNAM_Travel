"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { Content, Pagination } from "../../../shared/domain";
import { api, request } from "@/services/api";
import { Header, Footer } from "../SiteChrome";
import { useLanguage } from "../LanguageProvider";
import ContentCard from "../ui/ContentCard";
export default function Explorer({
  kind,
}: {
  kind: "provinces" | "destinations" | "specialties";
}) {
  const params = useSearchParams();
  const { t, locale, content } = useLanguage();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(params?.get("regionId") || "");
  const [province, setProvince] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Content[]>([]);
  const [regions, setRegions] = useState<Content[]>([]);
  const [provinces, setProvinces] = useState<Content[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<Content[]>(
        "/regions?limit=100",
        { signal: controller.signal },
        locale,
      ),
      api<Content[]>(
        "/provinces?limit=100",
        { signal: controller.signal },
        locale,
      ),
    ])
      .then(([r, p]) => {
        setRegions(r);
        setProvinces(p);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [locale]);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    const timer = setTimeout(() => {
      const q = new URLSearchParams({
        q: query,
        page: String(page),
        limit: "12",
        ...(region && kind === "provinces" ? { regionId: region } : {}),
        ...(province ? { provinceId: province } : {}),
        ...(category ? { category } : {}),
      });
      request<Content[]>(`/${kind}?${q}`, { signal: controller.signal }, locale)
        .then((result) => {
          setItems(result.data);
          setPagination(result.pagination || null);
          setState("done");
        })
        .catch(() => {
          if (!controller.signal.aborted) setState("error");
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, region, province, category, page, locale]);
  const title =
    kind === "provinces"
      ? t("Những miền đất Việt Nam.", "The places of Vietnam.")
      : kind === "destinations"
        ? t("Địa danh & những câu chuyện.", "Destinations & their stories.")
        : t("Hương vị của quê hương.", "A taste of belonging.");
  return (
    <>
      <Header />
      <main id="main" className={`section-wrap directory-page directory-${kind}`}>
        <div className="eyebrow">
          {t("BÁCH KHOA KHÁM PHÁ VIỆT NAM", "AN ATLAS OF DISCOVERY")}
        </div>
        <h1>{title}</h1>
        <div className="directory-controls">
          <label className="directory-search">
            <Search size={18} />
            <input
              aria-label={t("Tìm trong danh mục", "Search directory")}
              placeholder={t("Tìm một tên gọi…", "Find a name…")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {kind === "provinces" ? (
            <select
              aria-label={t("Lọc vùng miền", "Filter region")}
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("Tất cả vùng miền", "All regions")}</option>
              {regions.map((r) => (
                <option key={r._id} value={r._id}>
                  {content(r.name)}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label={t("Lọc tỉnh thành", "Filter province")}
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                {t("Tất cả tỉnh thành", "All provinces")}
              </option>
              {provinces.map((r) => (
                <option key={r._id} value={r._id}>
                  {content(r.name)}
                </option>
              ))}
            </select>
          )}
          {kind === "destinations" && (
            <select
              aria-label={t("Loại địa danh", "Destination category")}
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
          )}
        </div>
        {state === "loading" ? (
          <div
            className="place-grid skeleton-grid"
            aria-label={t("Đang tải", "Loading")}
          >
            {[1, 2, 3].map((i) => (
              <div key={i} />
            ))}
          </div>
        ) : state === "error" ? (
          <p role="alert">
            {t(
              "Chưa thể tải danh mục. Vui lòng thử lại.",
              "Unable to load the directory. Please try again.",
            )}
          </p>
        ) : (
          <>
            <p className="result-count" role="status">
              {pagination?.total || 0}{" "}
              {t("nội dung để khám phá", "stories to discover")}
            </p>
            <div className="place-grid">
              {items.map((item) => (
                <ContentCard
                  key={item._id}
                  item={item}
                  kind={
                    kind === "provinces"
                      ? "province"
                      : kind === "destinations"
                        ? "destination"
                        : "specialty"
                  }
                />
              ))}
            </div>
            {!items.length && (
              <div className="empty">
                <h3>
                  {t("Một miền khám phá đang chờ.", "A discovery awaits.")}
                </h3>
                <p>
                  {t(
                    "Thử từ khóa hoặc bộ lọc khác.",
                    "Try another keyword or filter.",
                  )}
                </p>
              </div>
            )}
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("Trang trước", "Previous")}
              </button>
              <span>
                {page} / {Math.max(1, pagination?.pages || 1)}
              </span>
              <button
                disabled={page >= (pagination?.pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("Trang sau", "Next")}
              </button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
