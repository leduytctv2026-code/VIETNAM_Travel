"use client";
import { useState } from "react";
import type { Content, Translation } from "../../../shared/domain";
import { useLanguage } from "../LanguageProvider";
import { api } from "@/services/api";
type Data = Record<string, unknown>;
type Field = [string, string, string, boolean?];
const fields: Record<string, Field[]> = {
  regions: [
    ["name", "Tên gọi", "Name"],
    ["description", "Giới thiệu vùng", "Region introduction", true],
  ],
  provinces: [
    ["name", "Tên gọi", "Name"],
    ["shortDescription", "Giới thiệu ngắn", "Short introduction", true],
    ["overview", "Tổng quan", "Overview", true],
    ["culture", "Văn hóa", "Culture", true],
    ["people", "Con người", "People", true],
    ["history.summary", "Lịch sử hình thành & phát triển", "History", true],
    ["geography.description", "Vị trí địa lý", "Geographic setting", true],
    ["geography.terrain", "Địa hình", "Terrain", true],
    ["geography.climate", "Khí hậu", "Climate", true],
    ["geography.boundaries", "Ranh giới", "Boundaries", true],
    [
      "fact",
      "Bạn có biết? (cần nguồn)",
      "Did you know? (source required)",
      true,
    ],
  ],
  destinations: [
    ["name", "Tên địa danh", "Name"],
    ["shortDescription", "Giới thiệu ngắn", "Short introduction", true],
    ["description", "Giới thiệu chi tiết", "Description", true],
    ["history.summary", "Lịch sử", "History", true],
    ["culturalValue", "Giá trị văn hóa", "Cultural value", true],
    ["geography.description", "Địa lý", "Geography", true],
    ["address", "Địa chỉ", "Address", true],
  ],
  specialties: [
    ["name", "Tên món ăn", "Name"],
    ["description", "Giới thiệu", "Introduction", true],
    ["origin", "Nguồn gốc", "Origins", true],
    ["culturalStory", "Câu chuyện văn hóa", "Cultural story", true],
    [
      "characteristics",
      "Thành phần & đặc trưng",
      "Ingredients & characteristics",
      true,
    ],
    ["servingGuide", "Cách thưởng thức", "Serving guide", true],
  ],
};
function get(data: Data, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((obj, key) => (obj as Data | undefined)?.[key], data);
}
function assign(data: Data, path: string, value: unknown): Data {
  const result = structuredClone(data);
  const keys = path.split(".");
  let current = result;
  for (const key of keys.slice(0, -1)) {
    current[key] ??= {};
    current = current[key] as Data;
  }
  current[keys.at(-1)!] = value;
  return result;
}

function coverImageIssue(value: string) {
  if (!value || value.startsWith("/")) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "not-secure";
    if (
      (url.hostname === "google.com" || url.hostname.endsWith(".google.com")) &&
      url.pathname === "/imgres"
    )
      return "google-results";
  } catch {
    return "invalid";
  }

  return null;
}
export function newContent(entity: string): Data {
  const data: Data = {
    slug: "",
    status: "draft",
    isSample: false,
    sources: [],
  };
  for (const [key] of fields[entity]) {
    const updated = assign(data, key, { vi: "", en: "" });
    Object.assign(data, updated);
  }
  if (entity === "regions") {
    data.order = 0;
    data.heroImage = "";
  }
  if (entity === "provinces") {
    data.regionId = "";
    data.coordinates = { type: "Point", coordinates: [108, 16] };
    data.history = { summary: { vi: "", en: "" }, events: [] };
    data.heroImage = "";
    data.gallery = [];
  }
  if (entity === "destinations") {
    data.provinceId = "";
    data.category = "heritage";
    data.location = { type: "Point", coordinates: [108, 16] };
    data.heroImage = "";
    data.officialGallery = [];
    data.history = { summary: { vi: "", en: "" }, events: [] };
  }
  if (entity === "specialties") {
    data.provinceId = "";
    data.images = [];
  }
  return data;
}
export default function ContentEditor({
  entity,
  initial,
  references,
  busy,
  onSave,
  onCancel,
}: {
  entity: string;
  initial: Data;
  references: Content[];
  busy: boolean;
  onSave: (data: Data) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, content } = useLanguage();
  const [data, setData] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const change = (key: string, value: unknown) =>
    setData((d) => assign(d, key, value));
  const galleryField =
    entity === "specialties"
      ? "images"
      : entity === "destinations"
        ? "officialGallery"
        : "gallery";
  const pointField = entity === "provinces" ? "coordinates" : "location";
  const coverIssue = coverImageIssue(String(data.heroImage || ""));
  const coverIssueMessage =
    coverIssue === "google-results"
      ? t(
          "Hãy dán URL tệp ảnh trực tiếp, không phải liên kết trang kết quả Google Images.",
          "Paste a direct image-file URL, not a Google Images result-page link.",
        )
      : coverIssue === "not-secure"
        ? t(
            "Liên kết ảnh phải bắt đầu bằng https://",
            "The image URL must start with https://",
          )
        : coverIssue === "invalid"
          ? t("Liên kết ảnh không hợp lệ.", "The image URL is invalid.")
          : "";
  const timeline = (get(data, "history.events") || []) as {
    year: string;
    title: Translation;
    description: Translation;
    source?: string;
  }[];
  return (
    <form
      className="content-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (coverIssueMessage) {
          setError(coverIssueMessage);
          return;
        }
        void onSave(data);
      }}
    >
      <div className="section-heading">
        <h2>{t("Biên tập nội dung", "Edit content")}</h2>
        <button type="button" className="text-link" onClick={onCancel}>
          {t("Đóng", "Close")} ×
        </button>
      </div>
      <div className="bilingual-fields">
        <label>
          Slug
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={String(data.slug || "")}
            onChange={(e) => change("slug", e.target.value)}
          />
        </label>
        <label>
          {t("Trạng thái", "Status")}
          <select
            value={String(data.status)}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="draft">{t("Bản nháp", "Draft")}</option>
            <option value="published">{t("Công bố", "Published")}</option>
            <option value="archived">{t("Lưu trữ", "Archived")}</option>
          </select>
        </label>
      </div>
      {entity !== "regions" && (
        <label>
          {entity === "provinces"
            ? t("Vùng miền", "Region")
            : t("Tỉnh thành", "Province")}
          <select
            required
            value={String(
              data[entity === "provinces" ? "regionId" : "provinceId"] || "",
            )}
            onChange={(e) =>
              change(
                entity === "provinces" ? "regionId" : "provinceId",
                e.target.value,
              )
            }
          >
            <option value="">{t("Chọn một mục", "Select an entry")}</option>
            {references.map((item) => (
              <option key={item._id} value={item._id}>
                {content(item.name)}
              </option>
            ))}
          </select>
        </label>
      )}
      {fields[entity].map(([key, vi, en, long]) => (
        <fieldset key={key}>
          <legend>{t(vi, en)}</legend>
          <div className="bilingual-fields">
            {(["vi", "en"] as const).map((lang) => (
              <label key={lang}>
                {lang === "vi" ? "Tiếng Việt" : "English"}
                {long ? (
                  <textarea
                    rows={key.includes("history") ? 6 : 3}
                    value={(get(data, key) as Translation)?.[lang] || ""}
                    onChange={(e) => change(`${key}.${lang}`, e.target.value)}
                    required={
                      lang === "vi" &&
                      ["description", "overview", "shortDescription"].includes(
                        key,
                      )
                    }
                    maxLength={20000}
                  />
                ) : (
                  <input
                    value={(get(data, key) as Translation)?.[lang] || ""}
                    required={lang === "vi"}
                    maxLength={160}
                    onChange={(e) => change(`${key}.${lang}`, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {["provinces", "destinations"].includes(entity) && (
        <>
          <fieldset>
            <legend>{t("Dòng thời gian", "Historical timeline")}</legend>
            {timeline.map((event, i) => (
              <div key={i} className="timeline-editor">
                <label>
                  {t("Mốc thời gian", "Year / period")}
                  <input
                    value={event.year}
                    onChange={(e) => {
                      const next = [...timeline];
                      next[i] = { ...event, year: e.target.value };
                      change("history.events", next);
                    }}
                  />
                </label>
                {(["vi", "en"] as const).map((lang) => (
                  <div key={lang}>
                    <label>
                      {lang.toUpperCase()} · {t("Tiêu đề", "Title")}
                      <input
                        value={event.title[lang] || ""}
                        onChange={(e) => {
                          const next = structuredClone(timeline);
                          next[i].title[lang] = e.target.value;
                          change("history.events", next);
                        }}
                      />
                    </label>
                    <label>
                      {t("Mô tả", "Description")}
                      <textarea
                        value={event.description[lang] || ""}
                        onChange={(e) => {
                          const next = structuredClone(timeline);
                          next[i].description[lang] = e.target.value;
                          change("history.events", next);
                        }}
                      />
                    </label>
                  </div>
                ))}
                <label>
                  {t("URL nguồn tư liệu", "Reference URL")}
                  <input
                    type="url"
                    value={event.source || ""}
                    onChange={(e) => {
                      const next = [...timeline];
                      next[i] = { ...event, source: e.target.value };
                      change("history.events", next);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    change(
                      "history.events",
                      timeline.filter((_, index) => i !== index),
                    )
                  }
                >
                  {t("Bỏ dấu mốc", "Remove milestone")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-link"
              onClick={() =>
                change("history.events", [
                  ...timeline,
                  {
                    year: "",
                    title: { vi: "", en: "" },
                    description: { vi: "", en: "" },
                  },
                ])
              }
            >
              {t("Thêm dấu mốc", "Add milestone")} +
            </button>
          </fieldset>
          <div className="bilingual-fields">
            {[0, 1].map((index) => (
              <label key={index}>
                {index === 0
                  ? t("Kinh độ", "Longitude")
                  : t("Vĩ độ", "Latitude")}
                <input
                  type="number"
                  step="any"
                  required
                  min={index === 0 ? -180 : -90}
                  max={index === 0 ? 180 : 90}
                  value={
                    (data[pointField] as { coordinates: number[] })
                      ?.coordinates[index] ?? 0
                  }
                  onChange={(e) => {
                    const coordinates = [
                      ...((data[pointField] as { coordinates: number[] })
                        ?.coordinates || [0, 0]),
                    ];
                    coordinates[index] = Number(e.target.value);
                    change(pointField, { type: "Point", coordinates });
                  }}
                />
              </label>
            ))}
          </div>
          <label>
            {t(
              "Diện tích km² (chỉ nhập khi xác minh)",
              "Area km² (verified values only)",
            )}
            <input
              type="number"
              min="0"
              step="any"
              value={String(get(data, "geography.areaKm2") ?? "")}
              onChange={(e) =>
                change(
                  "geography.areaKm2",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            />
          </label>
          <div className="bilingual-fields">
            <label>
              {t(
                "Ảnh lịch sử (cặp so sánh)",
                "Historical image (comparison pair)",
              )}
              <input
                value={String(get(data, "history.beforeImage") || "")}
                onChange={(e) =>
                  change("history.beforeImage", e.target.value || undefined)
                }
              />
            </label>
            <label>
              {t(
                "Ảnh hiện tại (cặp so sánh)",
                "Current image (comparison pair)",
              )}
              <input
                value={String(get(data, "history.afterImage") || "")}
                onChange={(e) =>
                  change("history.afterImage", e.target.value || undefined)
                }
              />
            </label>
          </div>
        </>
      )}
      {entity === "destinations" && (
        <label>
          {t("Loại địa danh", "Category")}
          <select
            value={String(data.category)}
            onChange={(e) => change("category", e.target.value)}
          >
            {["nature", "heritage", "culture", "museum"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      )}
      {entity === "regions" && (
        <label>
          {t("Thứ tự hiển thị", "Display order")}
          <input
            type="number"
            min="0"
            value={Number(data.order || 0)}
            onChange={(e) => change("order", Number(e.target.value))}
          />
        </label>
      )}
      {entity !== "specialties" && (
        <label>
          {t("Ảnh bìa — dán liên kết ảnh", "Cover image — paste an image link")}
          <input
            required
            inputMode="url"
            placeholder="https://example.com/photo.webp"
            value={String(data.heroImage || "")}
            onChange={(e) => {
              change("heroImage", e.target.value);
              setError("");
            }}
          />
          <small className="cover-image-help">
            {t(
              "Dán URL trực tiếp đến file ảnh (.jpg, .png, .webp), không dán link trang Google Images. Ảnh từ URL sẽ không được lưu trên máy chủ của bạn.",
              "Paste a direct image-file URL (.jpg, .png, .webp), not a Google Images page link. URL images are not stored on your server.",
            )}
          </small>
          {coverIssueMessage && (
            <small className="cover-image-error" role="alert">
              {coverIssueMessage}
            </small>
          )}
        </label>
      )}
      {entity !== "regions" && (
        <label>
          {t(
            "Thư viện ảnh chính thức — mỗi dòng một đường dẫn",
            "Official gallery — one image path per line",
          )}
          <textarea
            rows={3}
            value={((data[galleryField] || []) as string[]).join("\n")}
            onChange={(e) =>
              change(galleryField, e.target.value.split("\n").filter(Boolean))
            }
          />
        </label>
      )}
      <label>
        {t("Hoặc tải ảnh từ máy", "Or upload an image from your device")}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            setError("");
            const body = new FormData();
            body.set("image", file);
            try {
              const result = await api<{ url: string }>("/admin/media", {
                method: "POST",
                body,
              });
              setData((d) => ({
                ...d,
                ...(entity !== "specialties" && !d.heroImage
                  ? { heroImage: result.url }
                  : {}),
                ...(entity !== "regions"
                  ? {
                      [galleryField]: [
                        ...((d[galleryField] || []) as string[]),
                        result.url,
                      ],
                    }
                  : { heroImage: result.url }),
              }));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setUploading(false);
            }
          }}
        />
        <small className="cover-image-help">
          {t(
            "Ảnh tải lên được lưu trong thư viện media của website và tự dùng làm ảnh bìa nếu ô liên kết ảnh đang để trống.",
            "Uploaded images are stored in the website media library and become the cover image when the image-link field is empty.",
          )}
        </small>
      </label>
      {entity === "provinces" && (
        <label>
          {t("Nguồn cho mục Bạn có biết?", "Source for Did you know?")}
          <input
            type="url"
            value={String(data.factSource || "")}
            onChange={(e) => change("factSource", e.target.value)}
          />
        </label>
      )}
      <label>
        {t(
          "Nguồn tham khảo: Tên | URL, mỗi dòng một nguồn",
          "References: Title | URL, one per line",
        )}
        <textarea
          rows={3}
          defaultValue={(
            (data.sources || []) as { title: string; url: string }[]
          )
            .map((s) => `${s.title} | ${s.url}`)
            .join("\n")}
          onChange={(e) =>
            change(
              "sources",
              e.target.value
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const index = line.indexOf("|");
                  return {
                    title: line.slice(0, index).trim(),
                    url: line.slice(index + 1).trim(),
                  };
                }),
            )
          }
        />
      </label>
      <fieldset>
        <legend>SEO</legend>
        {["title", "description"].map((key) => (
          <div className="bilingual-fields" key={key}>
            {(["vi", "en"] as const).map((lang) => (
              <label key={lang}>
                {key} · {lang.toUpperCase()}
                <input
                  value={String(get(data, `seo.${key}.${lang}`) || "")}
                  onChange={(e) => change(`seo.${key}.${lang}`, e.target.value)}
                />
              </label>
            ))}
          </div>
        ))}
      </fieldset>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={!!data.isSample}
          onChange={(e) => change("isSample", e.target.checked)}
        />
        {t("Đánh dấu dữ liệu mẫu", "Mark as sample data")}
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy || uploading} className="green-button">
        {busy ? t("Đang lưu…", "Saving…") : t("Lưu nội dung", "Save content")}
      </button>
    </form>
  );
}
