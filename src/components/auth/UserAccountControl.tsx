"use client";

import Link from "next/link";

import { useLanguage } from "@/components/LanguageProvider";
import { useUserAuth } from "./UserAuthProvider";

export default function UserAccountControl() {
  const { t } = useLanguage();
  const { user, ready, openSignIn, signOut } = useUserAuth();

  if (!ready) return null;

  if (!user)
    return (
      <button
        className="header-sign-in"
        onClick={() =>
          openSignIn(
            t(
              "Đăng nhập để chia sẻ ảnh và bình luận.",
              "Sign in to share photographs and comments.",
            ),
          )
        }
      >
        {t("Đăng nhập", "Sign in")}
      </button>
    );

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="header-account">
      <Link href="/profile" className="header-profile-link">
        <span className="header-avatar" aria-hidden="true">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            initials
          )}
        </span>
        <span>{t("Hồ sơ", "Profile")}</span>
      </Link>
      <button
        className="header-sign-out"
        onClick={() => void signOut()}
        aria-label={t("Đăng xuất tài khoản", "Sign out of account")}
      >
        {t("Thoát", "Sign out")}
      </button>
    </div>
  );
}
