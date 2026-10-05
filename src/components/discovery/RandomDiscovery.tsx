"use client";
import { useState } from "react";
import Link from "next/link";
import { Compass, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../LanguageProvider";
import { api } from "@/services/api";
import type { Content } from "../../../shared/domain";
import { imageOf, related } from "@/lib/content";
import Photo from "../ui/Photo";
import { useHydratedReducedMotion } from "../motion/useHydratedReducedMotion";
export default function RandomDiscovery() {
  const { t, locale, content } = useLanguage();
  const [item, setItem] = useState<Content | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reduced = useHydratedReducedMotion();
  return (
    <section className="section-wrap random-discovery">
      <AnimatePresence initial={false}>
        {item && (
          <motion.div
            className="random-background"
            key={item._id}
            aria-hidden="true"
            initial={reduced ? false : { opacity: 0, scale: 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{
              duration: reduced ? 0 : 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Photo src={imageOf(item)} alt="" fill sizes="100vw" />
          </motion.div>
        )}
      </AnimatePresence>
      <Compass size={40} strokeWidth={1} />
      <div>
        <div className="eyebrow">
          {t("ĐÔI KHI, KHÔNG CẦN MỘT KẾ HOẠCH", "SOMETIMES, NO PLAN IS NEEDED")}
        </div>
        <h2>
          {t("Đưa tôi đến", "Take me")} <em>{t("một nơi.", "somewhere.")}</em>
        </h2>
        <p>
          {t(
            "Một gợi ý bất ngờ để bắt đầu câu chuyện tiếp theo.",
            "An unexpected suggestion for your next story.",
          )}
        </p>
        <AnimatePresence mode="wait">
          {item && (
            <motion.div
              className="random-result"
              key={item.slug}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{
                duration: reduced ? 0 : 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <strong>{content(item.name)}</strong>
              <span>{content(related(item.provinceId)?.name)}</span>
              <Link href={`/destination/${item.slug}`}>
                {t("Khám phá ngay", "Discover now")}
                <ArrowUpRight size={17} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        disabled={busy}
        className="green-button"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setItem(await api<Content>("/discover/random", {}, locale));
          } catch {
            setError(
              t(
                "Chưa có gợi ý lúc này. Hãy thử lại.",
                "No suggestion available right now. Try again.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? t("Đang mở một câu chuyện…", "Finding a story…")
          : t("Khám phá ngẫu nhiên", "Surprise me")}{" "}
        ↗
      </button>
    </section>
  );
}
