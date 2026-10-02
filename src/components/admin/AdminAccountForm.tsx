"use client";

import { useState } from "react";
import { api } from "@/services/api";
import { useLanguage } from "@/components/LanguageProvider";

type Account = { name: string; email: string; role?: string };
type UpdateResult = { account: Account; sessionRevoked: boolean };

export default function AdminAccountForm({
  account,
  onUpdated,
}: {
  account: Account;
  onUpdated: (result: UpdateResult) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(account.name || "");
  const [email, setEmail] = useState(account.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="admin-account-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setMessage("");
        const payload = {
          name,
          email,
          ...(currentPassword ? { currentPassword } : {}),
          ...(newPassword ? { newPassword } : {}),
        };
        void api<UpdateResult>("/admin/account", {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
          .then((result) => {
            setCurrentPassword("");
            setNewPassword("");
            onUpdated(result);
            if (!result.sessionRevoked)
              setMessage(t("Đã lưu hồ sơ quản trị.", "Admin profile saved."));
          })
          .catch((error: unknown) =>
            setMessage(
              error instanceof Error
                ? error.message
                : t("Không thể lưu thay đổi.", "Unable to save changes."),
            ),
          )
          .finally(() => setSaving(false));
      }}
    >
      <h2>{t("Tài khoản quản trị", "Admin account")}</h2>
      <p className="form-help">
        {t(
          "Đổi email hoặc mật khẩu yêu cầu mật khẩu hiện tại và sẽ đăng xuất tất cả phiên quản trị.",
          "Changing your email or password requires your current password and signs out all admin sessions.",
        )}
      </p>
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
        Email
        <input
          type="email"
          value={email}
          maxLength={254}
          required
          autoComplete="username"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        {t("Mật khẩu hiện tại", "Current password")}
        <input
          type="password"
          value={currentPassword}
          maxLength={200}
          autoComplete="current-password"
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </label>
      <label>
        {t("Mật khẩu mới", "New password")}
        <input
          type="password"
          value={newPassword}
          minLength={12}
          maxLength={200}
          autoComplete="new-password"
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </label>
      <button className="green-button" disabled={saving}>
        {saving ? t("Đang lưu…", "Saving…") : t("Lưu thay đổi", "Save changes")}
      </button>
      {message && (
        <p role="status" className="form-help">
          {message}
        </p>
      )}
    </form>
  );
}
