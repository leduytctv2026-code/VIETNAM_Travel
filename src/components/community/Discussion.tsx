"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Comment, Pagination } from "../../../shared/domain";
import { api, request } from "@/services/api";
import { useLanguage } from "../LanguageProvider";
import { useUserAuth } from "@/components/auth/UserAuthProvider";
import Captcha from "./Captcha";

export default function Discussion({
  destinationId,
  communityPostId,
}: {
  destinationId: string;
  communityPostId?: string;
}) {
  const { t, locale, content } = useLanguage();
  const { user, ready, openSignIn } = useUserAuth();
  const formId = useId();
  const [items, setItems] = useState<Comment[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const schema = useMemo(
    () =>
      z.object({
        content: z
          .string()
          .trim()
          .min(5, t("Nhập ít nhất 5 ký tự.", "Enter at least 5 characters."))
          .max(2000),
        website: z.string().max(0),
      }),
    [locale, t],
  );
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { content: "", website: "" },
  });

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    request<Comment[]>(
      `/comments?destinationId=${destinationId}${communityPostId ? `&communityPostId=${communityPostId}` : ""}&page=${page}&limit=10`,
      { signal: controller.signal },
      locale,
    )
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
        setStatus("done");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [destinationId, communityPostId, page, locale]);

  return (
    <div className="discussion">
      <div aria-live="polite">
        {status === "loading" ? (
          <p>{t("Đang tải thảo luận…", "Loading discussion…")}</p>
        ) : status === "error" ? (
          <p>{t("Chưa thể tải thảo luận.", "Unable to load discussion.")}</p>
        ) : !items.length ? (
          <p className="empty-copy">
            {t(
              "Một cuộc trò chuyện đang chờ bạn mở lời.",
              "A conversation is waiting for your first words.",
            )}
          </p>
        ) : (
          items.map((comment) => (
            <article className="comment" key={comment._id}>
              <strong>{comment.guestName}</strong>
              <time dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleDateString(
                  locale === "vi" ? "vi-VN" : "en-GB",
                )}
              </time>
              <p>{content(comment.content)}</p>
            </article>
          ))
        )}
        {(pagination?.pages || 0) > 1 && (
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {t("Trước", "Previous")}
            </button>
            <span>
              {page}/{pagination?.pages}
            </span>
            <button
              disabled={page === (pagination?.pages || 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("Sau", "Next")}
            </button>
          </div>
        )}
      </div>
      {!ready ? (
        <p className="form-help">
          {t("Đang kiểm tra phiên…", "Checking your session…")}
        </p>
      ) : !user ? (
        <aside className="auth-required">
          <h3>
            {t("Muốn góp một góc nhìn?", "Want to add your perspective?")}
          </h3>
          <p>
            {t(
              "Hãy đăng nhập để bình luận và giữ cuộc trò chuyện lành mạnh.",
              "Please sign in before commenting to help keep the conversation healthy.",
            )}
          </p>
          <button
            className="green-button"
            onClick={() =>
              openSignIn(
                t(
                  "Đăng nhập để gửi bình luận.",
                  "Sign in to submit a comment.",
                ),
              )
            }
          >
            {t("Đăng nhập để bình luận", "Sign in to comment")}
          </button>
        </aside>
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            setMessage("");
            try {
              await api(
                "/comments",
                {
                  method: "POST",
                  body: JSON.stringify({
                    ...values,
                    destinationId,
                    ...(communityPostId ? { communityPostId } : {}),
                    locale,
                    ...(captchaToken ? { captchaToken } : {}),
                  }),
                },
                locale,
              );
              reset();
              setMessage(
                t(
                  "Cảm ơn bạn. Bình luận đang chờ duyệt.",
                  "Thank you. Your comment is awaiting review.",
                ),
              );
            } catch (submissionError) {
              setMessage(
                submissionError instanceof Error
                  ? submissionError.message
                  : t("Không gửi được bình luận.", "Unable to submit comment."),
              );
            }
          })}
        >
          <h3>{t("Góp thêm một góc nhìn", "Add your perspective")}</h3>
          <p className="form-help">
            {t("Bình luận với", "Commenting as")} <strong>{user.name}</strong>
          </p>
          <label>
            {t("Bình luận", "Comment")} *
            <textarea
              rows={4}
              {...register("content")}
              aria-invalid={!!errors.content}
              aria-describedby={`${formId}-content-error`}
            />
            <span id={`${formId}-content-error`} className="field-error">
              {errors.content?.message}
            </span>
          </label>
          <div className="honeypot" aria-hidden="true">
            <label>
              Website
              <input
                {...register("website")}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>
          <Captcha onToken={setCaptchaToken} />
          <button className="green-button" disabled={isSubmitting}>
            {isSubmitting
              ? t("Đang gửi…", "Sending…")
              : t("Gửi bình luận", "Submit comment")}
          </button>
          <p role="status" className="form-help">
            {message ||
              t(
                "Bình luận được duyệt trước khi công khai.",
                "Comments are reviewed before publication.",
              )}
          </p>
        </form>
      )}
    </div>
  );
}
