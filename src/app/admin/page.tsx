"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { gsap } from "gsap";
import { api, request, ApiError } from "@/services/api";
import type { Content, Pagination, Text } from "../../../shared/domain";
import { useLanguage, LanguageSwitcher } from "@/components/LanguageProvider";
import ContentEditor, { newContent } from "@/components/admin/ContentEditor";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import AdminAccountForm from "@/components/admin/AdminAccountForm";
import Photo from "@/components/ui/Photo";
type Row = Record<string, unknown> & {
  _id: string;
  name?: Text;
  guestName?: string;
  status?: string;
};
const sections = [
  ["dashboard", "Tổng quan", "Dashboard"],
  ["regions", "Vùng miền", "Regions"],
  [
    "provinces",
    "Tỉnh thành · Lịch sử · Địa lý",
    "Provinces · History · Geography",
  ],
  [
    "destinations",
    "Địa danh · Official Gallery",
    "Destinations · Official Gallery",
  ],
  ["specialties", "Đặc sản", "Specialties"],
  ["community", "Ảnh cộng đồng", "Community images"],
  ["comments", "Bình luận", "Comments"],
  ["media", "Quản lý media", "Media library"],
  ["account", "Tài khoản admin", "Admin account"],
  ["settings", "Cấu hình", "Settings"],
];
const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export default function AdminPage() {
  const { t, content } = useLanguage();
  const [auth, setAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState("dashboard");
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>();
  const [items, setItems] = useState<Row[]>([]);
  const [references, setReferences] = useState<Content[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<Record<string, unknown> | null>(null);
  const [editId, setEditId] = useState("");
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loginRoot = useRef<HTMLElement>(null);
  const [dashboard, setDashboard] = useState<{
    counts: Record<string, number>;
    recent: Row[];
  }>();
  const [system, setSystem] = useState<Record<string, unknown>>({});
  const moderation = ["community", "comments"].includes(section);
  const loginMode = !checking && !auth;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  const fetchSection = useCallback(async () => {
    if (section === "dashboard") {
      setDashboard(await api("/admin/dashboard"));
      return;
    }
    if (["account", "settings"].includes(section)) {
      setSystem(await api(`/admin/${section}`));
      return;
    }
    const result = await request<Row[]>(
      `/admin/${section}?page=${page}&q=${encodeURIComponent(query)}${["community", "comments"].includes(section) ? `&status=${status}` : ""}`,
    );
    setItems(result.data);
    setPagination(result.pagination);
    setSelected([]);
  }, [section, page, query, status]);
  useEffect(() => {
    api("/auth/me")
      .then(() => setAuth(true))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const root = loginRoot.current;
    if (!loginMode || !root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
      });
      timeline
        .from(".admin-login-eyebrow", {
          autoAlpha: 0,
          y: 14,
          duration: 0.65,
        })
        .from(
          ".admin-login-heading-line",
          { yPercent: 110, duration: 0.9 },
          "-=0.42",
        )
        .from(
          ".admin-login-subtitle",
          { autoAlpha: 0, y: 14, duration: 0.65 },
          "-=0.5",
        )
        .from(
          ".admin-login-field, .admin-login-submit, .admin-login-footnote",
          {
            autoAlpha: 0,
            y: 18,
            duration: 0.68,
            stagger: 0.09,
          },
          "-=0.35",
        )
        .fromTo(
          ".admin-login-photo__image",
          { scale: 1.04 },
          { scale: 1, duration: 1 },
          0,
        )
        .from(
          ".admin-login-photo__quote",
          { autoAlpha: 0, y: 16, duration: 0.75 },
          0.35,
        );
    }, root);

    return () => context.revert();
  }, [loginMode]);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    const timer = setTimeout(
      () =>
        fetchSection().catch((error) => {
          if (active) {
            if (error instanceof ApiError && error.status === 401)
              setAuth(false);
            setMessage(error.message);
          }
        }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [auth, fetchSection]);
  useEffect(() => {
    if (
      !auth ||
      !["provinces", "destinations", "specialties"].includes(section)
    )
      return;
    api<Content[]>(
      `/admin/${section === "provinces" ? "regions" : "provinces"}?limit=100`,
    )
      .then(setReferences)
      .catch((e) => setMessage(e.message));
  }, [section, auth]);
  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
      await fetchSection();
      setMessage(t("Đã lưu thay đổi.", "Changes saved."));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setAuth(false);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changeSection(value: string) {
    setSection(value);
    setPage(1);
    setEditor(null);
    setItems([]);
    setSelected([]);
    setQuery("");
    setMessage("");
  }
  const title = (row: Row) => content(row.name) || row.guestName || row._id;
  return (
    <main
      id="main"
      className={`admin-app${loginMode ? " admin-app--login" : ""}`}
    >
      <aside
        className={`admin-sidebar${loginMode ? " admin-sidebar--login" : ""}`}
      >
        <Link href="/" className="footer-brand">
          vietnam unfolded.
        </Link>
        <small>{t("KHÔNG GIAN BIÊN TẬP", "EDITORIAL WORKSPACE")}</small>
        {auth && (
          <nav aria-label={t("Điều hướng quản trị", "Admin navigation")}>
            {sections.map(([id, vi, en]) => (
              <button
                className={section === id ? "active" : ""}
                key={id}
                onClick={() => changeSection(id)}
              >
                {t(vi, en)}
                {id === "community" && !!dashboard?.counts.pendingImages && (
                  <b>{dashboard.counts.pendingImages}</b>
                )}
                {id === "comments" && !!dashboard?.counts.pendingComments && (
                  <b>{dashboard.counts.pendingComments}</b>
                )}
              </button>
            ))}
          </nav>
        )}
        <LanguageSwitcher />
        <Link className="text-link" href="/">
          ← {t("Về website", "Back to website")}
        </Link>
      </aside>
      <section
        ref={loginRoot}
        className={`admin-main${loginMode ? " admin-main--login" : ""}`}
      >
        <div className={`admin-top${loginMode ? " admin-login-intro" : ""}`}>
          <div>
            <div
              className={`eyebrow${loginMode ? " admin-login-eyebrow" : ""}`}
            >
              {t("DI SẢN ĐƯỢC CHĂM CHÚT", "HERITAGE, CAREFULLY CURATED")}
            </div>
            <h1 className={loginMode ? "admin-login-heading-mask" : ""}>
              {loginMode ? (
                <span className="admin-login-heading-line">
                  {t("Bàn biên tập.", "The editorial desk.")}
                </span>
              ) : (
                t("Bàn biên tập.", "The editorial desk.")
              )}
            </h1>
          </div>
          {auth && (
            <button
              className="text-link"
              onClick={() =>
                void act(async () => {
                  await api("/auth/logout", { method: "POST" });
                  setAuth(false);
                  setEditor(null);
                })
              }
            >
              {t("Đăng xuất", "Sign out")}
            </button>
          )}
        </div>
        {checking ? (
          <p className="admin-session-check">
            {t("Đang kiểm tra phiên…", "Checking session…")}
          </p>
        ) : !auth ? (
          <>
            <form
              className="admin-login"
              noValidate
              onSubmit={handleSubmit(
                (values) =>
                  void act(async () => {
                    await api("/auth/login", {
                      method: "POST",
                      body: JSON.stringify(values),
                    });
                    setAuth(true);
                  }),
              )}
            >
              <h2>{t("Đăng nhập quản trị", "Editorial sign-in")}</h2>
              <p className="admin-login-subtitle">
                {t(
                  "Tiếp tục công việc tuyển chọn và kể lại những câu chuyện di sản Việt Nam.",
                  "Continue curating and telling the stories of Vietnam's living heritage.",
                )}
              </p>
              <label className="admin-login-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="editor@heritage.local"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
              </label>
              <div className="admin-login-field">
                <label htmlFor="admin-password">
                  {t("Mật khẩu", "Password")}
                </label>
                <span className="admin-password-control">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t("Nhập mật khẩu", "Enter your password")}
                    {...register("password")}
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    className="admin-password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={t(
                      showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu",
                      showPassword ? "Hide password" : "Show password",
                    )}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff size={19} aria-hidden="true" />
                    ) : (
                      <Eye size={19} aria-hidden="true" />
                    )}
                  </button>
                </span>
              </div>
              {(errors.email || errors.password || message) && (
                <p className="form-error admin-login-error" role="alert">
                  {errors.email || errors.password
                    ? t(
                        "Vui lòng nhập email và mật khẩu hợp lệ.",
                        "Please enter a valid email and password.",
                      )
                    : message}
                </p>
              )}
              <button
                type="submit"
                className="green-button admin-login-submit"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <>
                    <LoaderCircle
                      className="admin-login-spinner"
                      size={18}
                      aria-hidden="true"
                    />
                    {t("Đang đăng nhập…", "Signing in…")}
                  </>
                ) : (
                  t("Đăng nhập", "Sign in")
                )}
              </button>
              <p className="admin-login-footnote">
                {t(
                  "Không gian riêng dành cho đội ngũ biên tập.",
                  "A private space for the editorial team.",
                )}
              </p>
            </form>
            <aside
              className="admin-login-photo"
              aria-label={t(
                "Phong cảnh núi và ruộng bậc thang Việt Nam",
                "Vietnamese mountains and rice terraces",
              )}
            >
              <Image
                className="admin-login-photo__image"
                src="/images/admin-login-vietnam.png"
                alt=""
                fill
                preload
                sizes="(max-width: 900px) 100vw, 58vw"
              />
              <div className="admin-login-photo__overlay" aria-hidden="true" />
              <blockquote className="admin-login-photo__quote">
                <p>
                  {t(
                    "“Mỗi miền đất mở ra một cách khác để lắng nghe Việt Nam.”",
                    "“Every landscape offers another way to listen to Vietnam.”",
                  )}
                </p>
                <footer>vietnam unfolded. — editorial note</footer>
              </blockquote>
            </aside>
          </>
        ) : section === "dashboard" ? (
          <>
            <div className="dashboard-grid">
              {Object.entries(dashboard?.counts || {}).map(([key, value]) => (
                <div key={key}>
                  <span>
                    {
                      (
                        {
                          provinces: t("Tỉnh thành", "Provinces"),
                          destinations: t("Địa danh", "Destinations"),
                          specialties: t("Đặc sản", "Specialties"),
                          community: t("Ảnh cộng đồng", "Community images"),
                          pendingImages: t("Ảnh chờ duyệt", "Pending images"),
                          pendingComments: t(
                            "Bình luận chờ duyệt",
                            "Pending comments",
                          ),
                        } as Record<string, string>
                      )[key]
                    }
                  </span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <h2>{t("Hoạt động gần đây", "Recent activity")}</h2>
            {dashboard?.recent.map((row) => (
              <article className="admin-record" key={row._id}>
                <div>
                  <h3>{row.guestName}</h3>
                  <p>{content((row.caption || row.content) as Text)}</p>
                </div>
                <span className={`status-badge ${row.status}`}>
                  {row.status}
                </span>
              </article>
            ))}
          </>
        ) : section === "account" ? (
          <AdminAccountForm
            key={String(system.email || "loading")}
            account={system as { name: string; email: string; role?: string }}
            onUpdated={(result) => {
              setSystem((current) => ({ ...current, ...result.account }));
              if (result.sessionRevoked) {
                setAuth(false);
                setMessage(
                  t(
                    "Thông tin đăng nhập đã đổi. Vui lòng đăng nhập lại.",
                    "Your sign-in details changed. Please sign in again.",
                  ),
                );
              }
            }}
          />
        ) : section === "settings" ? (
          <dl className="settings-list">
            {Object.entries(system)
              .filter(([key]) => !["_id", "__v"].includes(key))
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <>
            <div className="admin-toolbar">
              <input
                aria-label={t("Tìm nội dung", "Search records")}
                placeholder={t("Tìm tên hoặc người gửi…", "Search names…")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              {moderation && (
                <div className="tabs">
                  {["pending", "approved", "rejected"].map((value) => (
                    <button
                      key={value}
                      className={status === value ? "active" : ""}
                      onClick={() => {
                        setStatus(value);
                        setPage(1);
                      }}
                    >
                      {
                        (
                          {
                            pending: t("Chờ duyệt", "Pending"),
                            approved: t("Đã duyệt", "Approved"),
                            rejected: t("Từ chối", "Rejected"),
                          } as Record<string, string>
                        )[value]
                      }
                    </button>
                  ))}
                </div>
              )}
              {!moderation && section !== "media" && (
                <button
                  className="green-button"
                  onClick={() => {
                    setEditId("");
                    setEditor(newContent(section));
                  }}
                >
                  {t("Thêm nội dung", "Create entry")} +
                </button>
              )}
              {section === "media" && (
                <label>
                  {t("Tải ảnh chính thức", "Upload official image")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const body = new FormData();
                        body.set("image", file);
                        void act(() =>
                          api("/admin/media", { method: "POST", body }),
                        );
                      }
                    }}
                  />
                </label>
              )}
            </div>
            {editor && (
              <ContentEditor
                key={`${section}-${editId}`}
                entity={section}
                initial={editor}
                references={references}
                busy={busy}
                onCancel={() => setEditor(null)}
                onSave={async (data) => {
                  await act(async () => {
                    await api(
                      `/admin/${section}${editId ? `/${editId}` : ""}`,
                      {
                        method: editId ? "PATCH" : "POST",
                        body: JSON.stringify(data),
                      },
                    );
                    setEditor(null);
                  });
                }}
              />
            )}
            {moderation && (
              <div className="admin-toolbar">
                <label>
                  <input
                    type="checkbox"
                    checked={!!items.length && selected.length === items.length}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? items.map((item) => item._id) : [],
                      )
                    }
                  />
                  {t("Chọn trang", "Select page")}
                </label>
                {["approve", "reject"].map((action) => (
                  <button
                    className="text-link"
                    disabled={busy || !selected.length}
                    key={action}
                    onClick={() =>
                      void act(() =>
                        api(`/admin/${section}/moderate`, {
                          method: "PATCH",
                          body: JSON.stringify({ ids: selected, action }),
                        }),
                      )
                    }
                  >
                    {action === "approve"
                      ? t("Duyệt đã chọn", "Approve selected")
                      : t("Từ chối đã chọn", "Reject selected")}{" "}
                    ({selected.length})
                  </button>
                ))}
              </div>
            )}
            <p className="result-count">
              {pagination?.total || 0} {t("bản ghi", "entries")}
            </p>
            {items.map((row) => (
              <article className="admin-record" key={row._id}>
                {moderation && (
                  <input
                    type="checkbox"
                    aria-label={`${t("Chọn", "Select")} ${title(row)}`}
                    checked={selected.includes(row._id)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked
                          ? [...s, row._id]
                          : s.filter((id) => id !== row._id),
                      )
                    }
                  />
                )}
                {(row.image || section === "media") && (
                  <Photo
                    src={String(row.image || `/api/v1/media/${row._id}`)}
                    alt={title(row)}
                  />
                )}
                <div>
                  <h3>{title(row)}</h3>
                  <p>
                    {moderation
                      ? content((row.caption || row.content) as Text)
                      : String(row.slug || "")}
                  </p>
                  {row.destinationId &&
                  typeof row.destinationId === "object" ? (
                    <p>{content((row.destinationId as Content).name)}</p>
                  ) : null}
                  {typeof row.createdAt === "string" && (
                    <small>{new Date(row.createdAt).toLocaleString()}</small>
                  )}
                  {section === "media" && (
                    <label>
                      {t(
                        "Đường dẫn để dùng trong nội dung",
                        "Path to use in content",
                      )}
                      <input
                        readOnly
                        value={`/api/v1/media/${row._id}`}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </label>
                  )}
                </div>
                {row.status && (
                  <span className={`status-badge ${row.status}`}>
                    {row.status}
                  </span>
                )}
                <div className="record-actions">
                  {moderation
                    ? ["approve", "reject"].map((action) => (
                        <button
                          key={action}
                          disabled={busy}
                          onClick={() =>
                            void act(() =>
                              api(`/admin/${section}/moderate`, {
                                method: "PATCH",
                                body: JSON.stringify({
                                  ids: [row._id],
                                  action,
                                }),
                              }),
                            )
                          }
                        >
                          {action === "approve"
                            ? t("Duyệt", "Approve")
                            : t("Từ chối", "Reject")}
                        </button>
                      ))
                    : section !== "media" && (
                        <button
                          onClick={() => {
                            const data = { ...row };
                            [
                              "_id",
                              "__v",
                              "createdAt",
                              "updatedAt",
                              "deletedAt",
                            ].forEach((key) => delete data[key]);
                            setEditId(row._id);
                            setEditor(data);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          {t("Sửa", "Edit")}
                        </button>
                      )}
                  <button disabled={busy} onClick={() => setDeleting(row)}>
                    {t("Xóa", "Delete")}
                  </button>
                </div>
              </article>
            ))}
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("Trước", "Previous")}
              </button>
              <span>
                {page}/{Math.max(1, pagination?.pages || 1)}
              </span>
              <button
                disabled={page >= (pagination?.pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("Sau", "Next")}
              </button>
            </div>
          </>
        )}
        <p role="status" className="admin-notice">
          {message}
        </p>
      </section>
      {deleting && (
        <ConfirmDialog
          label={title(deleting)}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const row = deleting;
            setDeleting(null);
            void act(() =>
              api(`/admin/${section}/${row._id}`, { method: "DELETE" }),
            );
          }}
        />
      )}
    </main>
  );
}
