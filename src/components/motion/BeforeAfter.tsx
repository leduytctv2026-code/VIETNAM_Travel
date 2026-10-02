"use client";
import { useState } from "react";
import Photo from "../ui/Photo";
import { useLanguage } from "../LanguageProvider";
export default function BeforeAfter({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const [value, setValue] = useState(50);
  const { t } = useLanguage();
  return (
    <figure className="before-after">
      <div>
        <Photo src={after} alt={t("Ảnh hiện tại", "Current view")} />
        <div style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
          <Photo
            src={before}
            alt={t("Ảnh tư liệu lịch sử", "Historical archive view")}
          />
        </div>
      </div>
      <label>
        {t(
          "Kéo để so sánh quá khứ và hiện tại",
          "Slide to compare past and present",
        )}
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
      </label>
    </figure>
  );
}
