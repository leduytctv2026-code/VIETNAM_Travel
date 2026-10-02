"use client";
import { useEffect, useRef } from "react";
import { useLanguage } from "../LanguageProvider";
export default function ConfirmDialog({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="upload-dialog"
      onCancel={onCancel}
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title">{t("Xóa nội dung này?", "Delete this entry?")}</h2>
      <p>{label}</p>
      <div className="admin-toolbar">
        <button className="green-button" onClick={onConfirm}>
          {t("Xác nhận xóa", "Confirm deletion")}
        </button>
        <button autoFocus className="text-link" onClick={onCancel}>
          {t("Hủy", "Cancel")}
        </button>
      </div>
    </dialog>
  );
}
