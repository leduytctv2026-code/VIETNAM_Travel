"use client";
import { Header, Footer } from "@/components/SiteChrome";
import { useLanguage } from "@/components/LanguageProvider";
import CommunityGallery from "@/components/community/CommunityGallery";
export default function Page() {
  const { t } = useLanguage();
  return (
    <>
      <Header />
      <main id="main" className="section-wrap directory-page">
        <div className="eyebrow">
          {t("VIỆT NAM QUA GÓC NHÌN CỦA BẠN", "VIETNAM THROUGH YOUR EYES")}
        </div>
        <h1>{t("Khoảnh khắc được sẻ chia.", "Moments, shared.")}</h1>
        <CommunityGallery />
      </main>
      <Footer />
    </>
  );
}
