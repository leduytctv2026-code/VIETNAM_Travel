"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Upload, X } from "lucide-react";
import type { Content } from "../../../shared/domain";
import { api } from "@/services/api";
import { useLanguage } from "../LanguageProvider";
import { useUserAuth } from "@/components/auth/UserAuthProvider";
import Captcha from "./Captcha";

export default function UploadModal({
  destination,
  onClose,
}: {
  destination?: Content;
  onClose: () => void;
}) {
  const { t, content, locale } = useLanguage();
  const { user } = useUserAuth();
  const ref = useRef<HTMLDialogElement>(null);
  const [destinations, setDestinations] = useState<Content[]>(
    destination ? [destination] : [],
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const schema = useMemo(
    () =>
      z.object({
        destinationId: z
          .string()
          .min(1, t("Hãy chọn địa danh.", "Choose a destination.")),
        caption: z.string().max(2000),
        takenAt: z.string(),
        website: z.string().max(0),
        image: z.custom<FileList>(
          (value) =>
            !!value &&
            typeof value === "object" &&
            "length" in value &&
            value.length === 1,
          t("Chọn một ảnh.", "Select one image."),
        ),
      }),
    [locale, t],
  );
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      destinationId: destination?._id || "",
      caption: "",
      takenAt: "",
      website: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    if (ref.current && !ref.current.open) ref.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!destination)
      api<Content[]>("/destinations?limit=100", {}, locale)
        .then(setDestinations)
        .catch(() =>
          setError(
            t(
              "Chưa tải được danh sách địa danh.",
              "Unable to load destinations.",
            ),
          ),
        );
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [destination, locale, t, user]);

  if (!user) return null;
  return (
    <dialog
      ref={ref}
      className="upload-dialog"
      aria-labelledby="upload-title"
      onCancel={onClose}
    >
      <button
        autoFocus
        className="detail-close icon-button"
        aria-label={t("Đóng biểu mẫu", "Close form")}
        onClick={onClose}
      >
        <X />
      </button>
      {done ? (
        <div className="success" role="status">
          <Check size={36} />
          <h2 id="upload-title">
            {t("Cảm ơn góc nhìn của bạn.", "Thank you for your perspective.")}
          </h2>
          <p>
            {t(
              "Ảnh đã được nhận và đang chờ xét duyệt. Nội dung chỉ hiển thị công khai sau khi được duyệt.",
              "Your photograph has been received and is awaiting review. It will appear publicly only after approval.",
            )}
          </p>
          <button className="green-button" onClick={onClose}>
            {t("Tiếp tục khám phá", "Continue exploring")}
          </button>
        </div>
      ) : (
        <>
          <div className="eyebrow">
            {t("CHIA SẺ KHOẢNH KHẮC", "SHARE A MOMENT")}
          </div>
          <h2 id="upload-title">
            {t("Việt Nam qua mắt bạn.", "Vietnam through your eyes.")}
          </h2>
          <p>
            {t(
              "Ảnh của bạn, câu chuyện của một nơi chốn.",
              "Your photograph, the story of a place.",
            )}
          </p>
          <p className="form-help">
            {t("Đăng ảnh với", "Posting as")} <strong>{user.name}</strong>
          </p>
          <form
            noValidate
            onSubmit={handleSubmit(async (values) => {
              setError("");
              const file = values.image[0];
              if (file.size > 4 * 1024 * 1024) {
                setError(
                  t(
                    "Ảnh không được vượt quá 4 MB.",
                    "The image must be no larger than 4 MB.",
                  ),
                );
                return;
              }
              const form = new FormData();
              form.set("image", file);
              for (const key of [
                "destinationId",
                "caption",
                "takenAt",
                "website",
              ] as const)
                if (values[key] || key === "website")
                  form.set(key, values[key]);
              form.set("locale", locale);
              if (captchaToken) form.set("captchaToken", captchaToken);
              try {
                await api("/community", { method: "POST", body: form }, locale);
                setDone(true);
              } catch (submissionError) {
                setError(
                  submissionError instanceof Error
                    ? submissionError.message
                    : t("Gửi ảnh thất bại.", "Unable to upload your image."),
                );
              }
            })}
          >
            <label>
              {t("Địa danh", "Destination")} *
              <select
                {...register("destinationId")}
                aria-invalid={!!errors.destinationId}
                aria-describedby="destination-error"
              >
                <option value="">
                  {t("Chọn một địa danh", "Choose a destination")}
                </option>
                {destinations.map((item) => (
                  <option key={item._id} value={item._id}>
                    {content(item.name)}
                  </option>
                ))}
              </select>
              <span id="destination-error" className="field-error">
                {errors.destinationId?.message}
              </span>
            </label>
            <label className="file-field">
              <Upload size={24} />
              {t("Ảnh thực tế của bạn", "Your photograph")} *
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                {...register("image")}
                aria-describedby="image-help image-error"
                aria-invalid={!!errors.image}
              />
              <small id="image-help">
                JPEG, PNG, WebP · 4 MB · ≥ 160 × 160 px
              </small>
              <span id="image-error" className="field-error">
                {errors.image?.message}
              </span>
            </label>
            <label>
              {t("Câu chuyện phía sau", "The story behind it")}
              <textarea rows={3} maxLength={2000} {...register("caption")} />
            </label>
            <label>
              {t("Ngày chụp (tùy chọn)", "Date taken (optional)")}
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                {...register("takenAt")}
              />
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
            <p className="form-help">
              {t(
                "Chỉ gửi ảnh bạn có quyền chia sẻ. Metadata của ảnh được loại bỏ khi xử lý.",
                "Only submit images you have permission to share. Image metadata is removed during processing.",
              )}
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="green-button" disabled={isSubmitting}>
              {isSubmitting
                ? t("Đang gửi ảnh…", "Uploading…")
                : t("Gửi để xét duyệt", "Submit for review")}{" "}
              →
            </button>
          </form>
        </>
      )}
    </dialog>
  );
}
