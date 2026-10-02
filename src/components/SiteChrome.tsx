"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Menu, X, ArrowUpRight, Leaf, Search } from "lucide-react";
import { useState } from "react";
import { LanguageSwitcher, useLanguage } from "./LanguageProvider";
import SearchOverlay from "./search/SearchOverlay";
import UserAccountControl from "./auth/UserAccountControl";
export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const links = [
    ["/", "Trang chủ", "Home"],
    ["/explore", "Khám phá", "Explore"],
    ["/destinations", "Địa danh", "Places"],
    ["/specialties", "Đặc sản", "Flavours"],
    ["/map", "Bản đồ", "Map"],
    ["/community", "Cộng đồng", "Community"],
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        {t("Đến nội dung chính", "Skip to main content")}
      </a>
      <header className="header">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Compass size={28} />
          </span>
          <span>
            vietnam<span className="brand-sub">UNFOLDED</span>
          </span>
          <span className="brand-dot">.</span>
        </Link>
        <nav
          aria-label={t("Điều hướng chính", "Main navigation")}
          className={open ? "nav open" : "nav"}
        >
          {links.map(([href, vi, en]) => (
            <Link href={href} key={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>
              {t(vi, en)}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={t("Tìm kiếm toàn bộ di sản", "Search all heritage")}
            onClick={() => setSearch(true)}
          >
            <Search size={19} />
          </button>
          <LanguageSwitcher />
          <UserAccountControl />
          <button
            className="mobile-menu icon-button"
            aria-label={t("Mở điều hướng", "Toggle navigation")}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
    </>
  );
}
export function SampleNote() {
  const { t } = useLanguage();
  return (
    <p className="archive-note">
      {t(
        "Hồ sơ mẫu để trải nghiệm nền tảng. Ảnh mang tính minh họa, tọa độ có tính định hướng. Nội dung cần được biên tập xác minh trước khi công bố chính thức.",
        "Sample profile for exploring the platform. Images are illustrative and coordinates approximate. Content requires editorial verification before official publication.",
      )}
    </p>
  );
}
export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-intro">
        <Link href="/" className="footer-brand">
          vietnam unfolded<span>.</span>
        </Link>
        <p>
          <Leaf size={14} style={{ display: "inline", marginRight: 7 }} />
          {t(
            "Vì tri thức. Vì di sản. Phi thương mại.",
            "For knowledge. For heritage. Non-commercial.",
          )}
        </p>
        </div>
        <nav className="footer-column" aria-label={t("Khám phá ở chân trang", "Footer discovery")}>
          <h3>{t("Khám phá", "Discover")}</h3>
          <Link href="/explore">{t("Vùng miền & tỉnh thành", "Regions & provinces")}</Link>
          <Link href="/destinations">{t("Địa danh", "Destinations")}</Link>
          <Link href="/map">{t("Bản đồ Việt Nam", "Vietnam map")}</Link>
        </nav>
        <nav className="footer-column" aria-label={t("Văn hóa ở chân trang", "Footer culture")}>
          <h3>{t("Kết nối", "Connect")}</h3>
          <Link href="/specialties">{t("Hương vị Việt Nam", "Local flavours")}</Link>
          <Link href="/community">{t("Cộng đồng", "Community")}</Link>
          <Link href="/admin">{t("Ban biên tập", "Editorial access")}</Link>
        </nav>
        <div className="footer-column"><h3>{t("Ngôn ngữ", "Language")}</h3><LanguageSwitcher fullNames /></div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">VIETNAM UNFOLDED</div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Vietnam, Unfolded</span>
        <span>
          {t(
            "Lưu giữ ký ức, kết nối thế hệ.",
            "Preserving memories, connecting generations.",
          )}
        </span>
        <Link href="/admin">
          {t("Ban biên tập", "Editorial access")}
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </footer>
  );
}
export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("Đường dẫn", "Breadcrumb")} className="breadcrumbs">
      <Link href="/">{t("Việt Nam", "Vietnam")}</Link>
      {items.map((item, i) => (
        <span key={i}>
          {" "}
          /{" "}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
