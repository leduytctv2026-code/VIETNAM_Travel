"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Eye, EyeOff, LoaderCircle, X } from "lucide-react";

import type { UserProfile } from "../../../shared/domain";
import { useLanguage } from "@/components/LanguageProvider";
import { api } from "@/services/api";

type AuthProviders = {
  google: boolean;
  facebook: boolean;
};

type UserAuthContextValue = {
  user: UserProfile | null;
  ready: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  openSignIn: (reason?: string) => void;
};

const UserAuthContext = createContext<UserAuthContextValue | undefined>(
  undefined,
);

export function UserAuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: UserProfile | null;
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser ?? null);
  const [ready, setReady] = useState(initialUser !== undefined);
  const [signInReason, setSignInReason] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    try {
      setUser(await api<UserProfile>("/auth/user/me"));
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (initialUser !== undefined) return;
    void refresh();
  }, [initialUser, refresh]);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/user/logout", { method: "POST" });
    } catch {
      // An expired session is already signed out from the user's perspective.
    } finally {
      setUser(null);
    }
  }, []);

  const value: UserAuthContextValue = {
    user,
    ready,
    refresh,
    signOut,
    openSignIn: (reason?: string) => setSignInReason(reason || ""),
  };

  return (
    <UserAuthContext.Provider value={value}>
      {children}
      <UserSignInDialog
        reason={signInReason}
        onClose={() => setSignInReason(undefined)}
        onAuthenticated={setUser}
      />
    </UserAuthContext.Provider>
  );
}

export function useUserAuth(): UserAuthContextValue {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error("useUserAuth must be used inside UserAuthProvider");
  }
  return context;
}

function UserSignInDialog({
  reason,
  onClose,
  onAuthenticated,
}: {
  reason: string | undefined;
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
}) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [mode, setMode] = useState<"sign-in" | "register" | "forgot" | "reset">(
    "sign-in",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const open = reason !== undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setMode("sign-in");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");

    let active = true;
    api<AuthProviders>("/auth/providers")
      .then((result) => {
        if (active) setProviders(result);
      })
      .catch(() => {
        if (active) setProviders({ google: false, facebook: false });
      });

    return () => {
      active = false;
    };
  }, [open]);

  const changeMode = (next: typeof mode) => {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if ((mode === "register" || mode === "reset") && password.length < 12) {
      setError(
        t("Mật khẩu cần ít nhất 12 ký tự.", "Use at least 12 characters."),
      );
      return;
    }
    if (
      (mode === "register" || mode === "reset") &&
      password !== confirmPassword
    ) {
      setError(t("Mật khẩu xác nhận chưa khớp.", "Passwords do not match."));
      return;
    }

    setBusy(true);
    try {
      if (mode === "forgot") {
        const result = await api<{
          message: string;
          developmentResetToken?: string;
        }>("/auth/user/password/forgot", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        if (result.developmentResetToken) {
          setResetToken(result.developmentResetToken);
          setMode("reset");
          setNotice(
            t(
              "Chế độ phát triển: hãy đặt mật khẩu mới ngay bên dưới.",
              "Development mode: set your new password below.",
            ),
          );
        } else setNotice(result.message);
        return;
      }
      if (mode === "reset") {
        await api("/auth/user/password/reset", {
          method: "POST",
          body: JSON.stringify({ token: resetToken, password }),
        });
        changeMode("sign-in");
        setNotice(
          t(
            "Mật khẩu đã được đổi. Bạn có thể đăng nhập.",
            "Password updated. You can now sign in.",
          ),
        );
        return;
      }

      const user = await api<UserProfile>(
        mode === "register" ? "/auth/user/register" : "/auth/user/login",
        {
          method: "POST",
          body: JSON.stringify(
            mode === "register"
              ? { name, email, password }
              : { email, password },
          ),
        },
      );
      onAuthenticated(user);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Không thể hoàn tất yêu cầu.", "Unable to complete the request."),
      );
    } finally {
      setBusy(false);
    }
  };

  const socialLabel = (provider: "Google" | "Facebook") =>
    mode === "register"
      ? t(`Đăng ký với ${provider}`, `Sign up with ${provider}`)
      : t(`Tiếp tục với ${provider}`, `Continue with ${provider}`);

  const passwordField = (confirm = false) => (
    <label className="auth-dialog__field">
      <span>
        {confirm
          ? t("Xác nhận mật khẩu", "Confirm password")
          : t("Mật khẩu", "Password")}
      </span>
      <span className="auth-dialog__password">
        <input
          type={showPassword ? "text" : "password"}
          autoComplete={
            mode === "sign-in" && !confirm ? "current-password" : "new-password"
          }
          minLength={mode === "sign-in" ? 1 : 12}
          maxLength={200}
          required
          value={confirm ? confirmPassword : password}
          onChange={(event) =>
            confirm
              ? setConfirmPassword(event.target.value)
              : setPassword(event.target.value)
          }
        />
        {!confirm ? (
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={t(
              showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu",
              showPassword ? "Hide password" : "Show password",
            )}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}
      </span>
    </label>
  );

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby="user-sign-in-title"
      onClose={onClose}
    >
      <div className="auth-dialog__inner">
        <button
          type="button"
          className="auth-dialog__close"
          onClick={onClose}
          aria-label={t("Đóng", "Close")}
        >
          <X aria-hidden="true" size={20} />
        </button>
        <p className="eyebrow">
          {t("THAM GIA CỘNG ĐỒNG", "JOIN THE COMMUNITY")}
        </p>
        <h2 id="user-sign-in-title">
          {mode === "register"
            ? t("Tạo tài khoản.", "Create an account.")
            : mode === "forgot"
              ? t("Tìm lại mật khẩu.", "Recover your password.")
              : mode === "reset"
                ? t("Đặt mật khẩu mới.", "Set a new password.")
                : t("Đăng nhập để chia sẻ.", "Sign in to share.")}
        </h2>
        <p className="auth-dialog__lead">
          {mode === "register"
            ? t(
                "Tạo hồ sơ để đăng ảnh, bình luận và lưu dấu hành trình của bạn.",
                "Create a profile to share photographs, comments and your journey.",
              )
            : mode === "forgot"
              ? t(
                  "Nhập email đã đăng ký để bắt đầu đặt lại mật khẩu.",
                  "Enter your registered email to begin resetting your password.",
                )
              : mode === "reset"
                ? t(
                    "Chọn mật khẩu mới có ít nhất 12 ký tự.",
                    "Choose a new password with at least 12 characters.",
                  )
                : reason ||
                  t(
                    "Dùng tài khoản của bạn để đăng ảnh và bình luận.",
                    "Use your account to share photographs and comments.",
                  )}
        </p>

        {mode === "sign-in" || mode === "register" ? (
          <>
            <div className="auth-dialog__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sign-in"}
                onClick={() => changeMode("sign-in")}
              >
                {t("Đăng nhập", "Sign in")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => changeMode("register")}
              >
                {t("Đăng ký", "Sign up")}
              </button>
            </div>
            <div className="auth-dialog__providers">
              {providers?.google ? (
                <a href="/api/v1/auth/google">
                  <GoogleIcon />
                  <span>{socialLabel("Google")}</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title={t(
                    "Chưa cấu hình OAuth Google",
                    "Google OAuth is not configured",
                  )}
                >
                  <GoogleIcon />
                  <span>{socialLabel("Google")}</span>
                  <small>{t("Chưa cấu hình", "Not configured")}</small>
                </button>
              )}
              {providers?.facebook ? (
                <a href="/api/v1/auth/facebook">
                  <FacebookIcon />
                  <span>{socialLabel("Facebook")}</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title={t(
                    "Chưa cấu hình OAuth Facebook",
                    "Facebook OAuth is not configured",
                  )}
                >
                  <FacebookIcon />
                  <span>{socialLabel("Facebook")}</span>
                  <small>{t("Chưa cấu hình", "Not configured")}</small>
                </button>
              )}
            </div>
            <div className="auth-dialog__divider">
              <span>{t("hoặc dùng email", "or use email")}</span>
            </div>
          </>
        ) : null}

        <form className="auth-dialog__form" onSubmit={submit}>
          {mode === "register" ? (
            <label className="auth-dialog__field">
              <span>{t("Tên hiển thị", "Display name")}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={100}
                required
              />
            </label>
          ) : null}
          {mode !== "reset" ? (
            <label className="auth-dialog__field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
          ) : null}
          {mode !== "forgot" ? passwordField() : null}
          {mode === "register" || mode === "reset" ? passwordField(true) : null}
          {mode === "sign-in" ? (
            <button
              type="button"
              className="auth-dialog__forgot"
              onClick={() => changeMode("forgot")}
            >
              {t("Quên mật khẩu?", "Forgot password?")}
            </button>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="auth-dialog__notice" role="status">
              {notice}
            </p>
          ) : null}
          <button className="auth-dialog__submit" type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="auth-dialog__spinner" size={18} />
            ) : null}
            {mode === "register"
              ? t("Tạo tài khoản", "Create account")
              : mode === "forgot"
                ? t("Gửi hướng dẫn", "Send instructions")
                : mode === "reset"
                  ? t("Đổi mật khẩu", "Update password")
                  : t("Đăng nhập", "Sign in")}
          </button>
          {mode === "forgot" || mode === "reset" ? (
            <button
              type="button"
              className="auth-dialog__back"
              onClick={() => changeMode("sign-in")}
            >
              {t("← Quay lại đăng nhập", "← Back to sign in")}
            </button>
          ) : null}
        </form>
      </div>
    </dialog>
  );
}

function GoogleIcon() {
  return (
    <svg className="auth-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.52c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#fbbc05"
        d="M6.39 13.88A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.88v-2.6H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.6Z"
      />
      <path
        fill="#ea4335"
        d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.6C7.18 7.75 9.39 5.99 12 5.99Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="auth-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1877f2" />
      <path
        fill="#fff"
        d="M13.47 21v-8.2h2.75l.42-3.2h-3.17V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14A22.7 22.7 0 0 0 14.28 3c-2.45 0-4.13 1.5-4.13 4.25V9.6H7.38v3.2h2.77V21h3.32Z"
      />
    </svg>
  );
}
