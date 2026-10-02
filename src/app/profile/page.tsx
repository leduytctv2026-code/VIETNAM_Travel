"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer } from "@/components/SiteChrome";
import { useLanguage } from "@/components/LanguageProvider";
import { useUserAuth } from "@/components/auth/UserAuthProvider";
import { api } from "@/services/api";
import type { UserProfile } from "../../../shared/domain";

export default function ProfilePage() {
  return (
    <>
      <Header />
      <main id="main" className="section-wrap profile-page">
        <Suspense fallback={<p>Loading profile…</p>}>
          <ProfileContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

function ProfileContent() {
  const { t } = useLanguage();
  const { user, ready, openSignIn } = useUserAuth();
  const params = useSearchParams();
  if (!ready)
    return <p>{t("Đang kiểm tra phiên…", "Checking your session…")}</p>;
  if (!user)
    return (
      <section className="profile-card profile-sign-in">
        <div className="eyebrow">
          {t("KHÔNG GIAN CỘNG ĐỒNG", "COMMUNITY SPACE")}
        </div>
        <h1>{t("Hồ sơ của bạn", "Your profile")}</h1>
        {params?.get("auth") === "failed" && (
          <p className="form-error" role="alert">
            {t(
              "Không thể hoàn tất đăng nhập. Vui lòng thử lại.",
              "We could not complete sign-in. Please try again.",
            )}
          </p>
        )}
        <p>
          {t(
            "Đăng nhập bằng Google hoặc Facebook để quản lý hồ sơ, đăng ảnh và bình luận.",
            "Sign in with Google or Facebook to manage your profile, share photos, and comment.",
          )}
        </p>
        <button className="green-button" onClick={() => openSignIn()}>
          {t("Đăng nhập", "Sign in")}
        </button>
      </section>
    );
  return <ProfileEditor key={user.id} user={user} />;
}

function ProfileEditor({ user }: { user: UserProfile }) {
  const { t, locale } = useLanguage();
  const { refresh } = useUserAuth();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [location, setLocation] = useState(user.location);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section className="profile-card">
      <div className="eyebrow">
        {t("KHÔNG GIAN CỘNG ĐỒNG", "COMMUNITY SPACE")}
      </div>
      <h1>{t("Hồ sơ của bạn", "Your profile")}</h1>
      <div className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            initials
          )}
        </span>
        <div>
          <strong>{user.name}</strong>
          <p>
            {user.email ||
              t(
                "Email không được nhà cung cấp chia sẻ.",
                "Your provider did not share an email address.",
              )}
          </p>
        </div>
      </div>
      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          setMessage("");
          void api<UserProfile>(
            "/auth/user/profile",
            {
              method: "PATCH",
              body: JSON.stringify({ name, bio, location, locale }),
            },
            locale,
          )
            .then(async () => {
              await refresh();
              setMessage(t("Đã lưu hồ sơ.", "Profile saved."));
            })
            .catch((error: unknown) =>
              setMessage(
                error instanceof Error
                  ? error.message
                  : t("Không thể lưu hồ sơ.", "Unable to save your profile."),
              ),
            )
            .finally(() => setSaving(false));
        }}
      >
        <label>
          {t("Tên hiển thị", "Display name")}
          <input
            value={name}
            maxLength={100}
            required
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          {t("Giới thiệu", "About you")}
          <textarea
            rows={4}
            value={bio}
            maxLength={500}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>
        <label>
          {t("Địa điểm", "Location")}
          <input
            value={location}
            maxLength={120}
            autoComplete="address-level2"
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
        <p className="form-help">
          {t(
            "Ảnh đại diện được lấy từ tài khoản Google hoặc Facebook của bạn.",
            "Your avatar is supplied by your Google or Facebook account.",
          )}
        </p>
        <button className="green-button" disabled={saving}>
          {saving ? t("Đang lưu…", "Saving…") : t("Lưu hồ sơ", "Save profile")}
        </button>
        {message && (
          <p role="status" className="form-help">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
