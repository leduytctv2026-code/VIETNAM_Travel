import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/LanguageProvider";
import MotionSystem from "@/components/MotionSystem";
import { UserAuthProvider } from "@/components/auth/UserAuthProvider";
import { Be_Vietnam_Pro, Noto_Serif } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/public.css";
import "../styles/home-scenes.css";
import "../styles/home-panels.css";
import "../styles/home-motion.css";
const displayFont = Noto_Serif({
  subsets: ["vietnamese", "latin"],
  variable: "--font-display",
  display: "swap",
});
const bodyFont = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700"],
  subsets: ["vietnamese", "latin"],
  variable: "--font-body",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(process.env.FRONTEND_URL || "http://localhost:3000"),
  title: {
    default: "Việt Nam, mở ra — Di sản & ký ức",
    template: "%s · Vietnam, Unfolded",
  },
  description:
    "Khám phá địa lý, lịch sử, văn hóa, địa danh và đặc sản Việt Nam. Nền tảng tri thức và cộng đồng phi thương mại.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale =
    (await cookies()).get("atlas_locale")?.value === "en" ? "en" : "vi";
  return (
    <html lang={locale}>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <LanguageProvider initialLocale={locale}>
          <MotionSystem />
          <UserAuthProvider>{children}</UserAuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
