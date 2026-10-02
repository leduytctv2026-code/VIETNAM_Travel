"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowUpRight } from "lucide-react";
import { useLanguage } from "../LanguageProvider";
import { api } from "@/services/api";
import type { SearchHit } from "../../../shared/domain";
function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  return index < 0 || !query ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}
export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { locale, t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState("idle");
  useEffect(() => {
    ref.current?.showModal();
    input.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    const timer = setTimeout(
      () =>
        api<SearchHit[]>(
          `/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
          locale,
        )
          .then((items) => {
            setHits(items);
            setActive(-1);
            setState("done");
          })
          .catch(() => {
            if (!controller.signal.aborted) setState("error");
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);
  function choose(hit: SearchHit) {
    onClose();
    router.push(hit.href);
  }
  const groups = {
    provinces: t("Tỉnh / thành", "Provinces"),
    destinations: t("Địa danh", "Destinations"),
    specialties: t("Đặc sản", "Specialties"),
    history: t("Lịch sử", "History"),
  };
  return (
    <dialog
      ref={ref}
      className="search-dialog"
      onCancel={onClose}
      aria-labelledby="search-title"
    >
      <button
        className="detail-close icon-button"
        onClick={onClose}
        aria-label={t("Đóng tìm kiếm", "Close search")}
      >
        <X />
      </button>
      <div className="eyebrow">
        {t("ĐỂ SỰ TÒ MÒ DẪN LỐI", "FOLLOW YOUR CURIOSITY")}
      </div>
      <h2 id="search-title">
        {t("Bạn muốn khám phá điều gì?", "What would you like to discover?")}
      </h2>
      <div className="mega-input">
        <Search />
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            "Địa danh, tỉnh thành, lịch sử, đặc sản…",
            "Places, provinces, history, flavours…",
          )}
          role="combobox"
          aria-label={t("Từ khóa tìm kiếm", "Search keywords")}
          aria-autocomplete="list"
          aria-controls="search-list"
          aria-expanded={hits.length > 0}
          aria-activedescendant={
            active >= 0 ? `search-hit-${active}` : undefined
          }
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && hits.length) {
              e.preventDefault();
              setActive((i) => (i + 1) % hits.length);
            } else if (e.key === "ArrowUp" && hits.length) {
              e.preventDefault();
              setActive((i) => (i - 1 + hits.length) % hits.length);
            } else if (e.key === "Enter" && hits[active]) choose(hits[active]);
          }}
        />
      </div>
      <p className="search-status" role="status">
        {state === "loading"
          ? t("Đang tìm những câu chuyện…", "Finding stories…")
          : state === "error"
            ? t(
                "Tìm kiếm tạm thời gián đoạn. Vui lòng thử lại.",
                "Search is temporarily unavailable. Please try again.",
              )
            : state === "idle"
              ? t(
                  "Nhập ít nhất hai ký tự để bắt đầu.",
                  "Enter at least two characters to begin.",
                )
              : !hits.length
                ? t(
                    "Chưa có câu chuyện phù hợp. Hãy thử một từ khóa khác.",
                    "No matching stories yet. Try another keyword.",
                  )
                : `${hits.length} ${t("gợi ý khám phá", "discoveries")}`}
      </p>
      <div id="search-list" role="listbox">
        {hits.map((hit, i) => (
          <button
            type="button"
            id={`search-hit-${i}`}
            role="option"
            aria-selected={i === active}
            className="search-hit"
            key={hit.href + hit.kind}
            onClick={() => choose(hit)}
          >
            <span>
              <small>{groups[hit.kind]}</small>
              <strong>
                <Highlight text={hit.title} query={query} />
              </strong>
              <p>{hit.excerpt}</p>
            </span>
            <ArrowUpRight size={20} />
          </button>
        ))}
      </div>
    </dialog>
  );
}
