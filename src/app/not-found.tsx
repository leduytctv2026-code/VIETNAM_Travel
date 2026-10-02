"use client";
import Link from "next/link";
import { Header, Footer } from "@/components/SiteChrome";
import { useLanguage } from "@/components/LanguageProvider";
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <>
      <Header />
      <main id="main" className="empty not-found">
        <div className="eyebrow">404 · VIETNAM, UNFOLDED</div>
        <h1>{t("Câu chuyện này chưa mở.", "This story is not here yet.")}</h1>
        <p>
          {t(
            "Hãy trở lại bản đồ để tìm một miền khám phá khác.",
            "Return to the atlas to find another discovery.",
          )}
        </p>
        <Link className="green-button" href="/explore">
          {t("Tiếp tục khám phá", "Continue exploring")} ↗
        </Link>
      </main>
      <Footer />
    </>
  );
}
