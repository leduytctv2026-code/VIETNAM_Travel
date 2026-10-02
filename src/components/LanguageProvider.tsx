"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import type { Locale, Text } from "../../shared/domain";
import { text } from "@/lib/content";
type ContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (vi: string, en: string) => string;
  content: (value: Text | undefined) => string;
};
const Context = createContext<ContextValue | null>(null);
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLanguage] = useState(initialLocale);
  const router = useRouter();
  const setLocale = useCallback(
    (value: Locale) => {
      setLanguage(value);
      document.cookie = `atlas_locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      router.refresh();
    },
    [router],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <Context.Provider
      value={{
        locale,
        setLocale,
        t: (vi, en) => (locale === "vi" ? vi : en),
        content: (value) => text(value, locale),
      }}
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </Context.Provider>
  );
}
export function useLanguage() {
  const value = useContext(Context);
  if (!value) throw new Error("LanguageProvider required");
  return value;
}
export function LanguageSwitcher({ fullNames = false }: { fullNames?: boolean }) {
  const { locale, setLocale } = useLanguage();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label="Ngôn ngữ / Language"
    >
      {(["vi", "en"] as const).map((lang) => (
        <button
          key={lang}
          lang={lang}
          aria-pressed={locale === lang}
          onClick={() => setLocale(lang)}
        >
          {fullNames ? (lang === "vi" ? "Tiếng Việt" : "English") : lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
