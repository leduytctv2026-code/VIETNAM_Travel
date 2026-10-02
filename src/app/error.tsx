"use client";
import { useLanguage } from "@/components/LanguageProvider";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <main id="main" className="admin-shell">
      <div className="eyebrow">{t("MỘT KHOẢNG DỪNG", "A MOMENT OF PAUSE")}</div>
      <h1>
        {t(
          "Chưa thể mở câu chuyện này.",
          "This story is temporarily unavailable.",
        )}
      </h1>
      <p style={{ marginBottom: 24 }}>
        {t("Vui lòng thử lại sau ít phút.", "Please try again in a moment.")}
      </p>
      <button className="green-button" onClick={reset}>
        {t("Thử lại", "Try again")}
      </button>
    </main>
  );
}
