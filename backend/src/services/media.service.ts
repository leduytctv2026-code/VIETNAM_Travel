import sharp, { type Metadata } from "sharp";
import path from "node:path";
import { models } from "../models/index.ts";
import type { MediaProvider } from "../providers/media.ts";
import type { Config } from "../config/env.ts";
import { AppError } from "../utils/http.ts";
export async function storeImage(
  file: Express.Multer.File | undefined,
  provider: MediaProvider,
  config: Config,
  purpose: "official" | "community",
  adminId?: string,
) {
  if (!file) throw new AppError(400, "Vui lòng chọn một ảnh.");
  const ext = path.extname(file.originalname).toLowerCase();
  const formats: Record<string, string[]> = {
    jpeg: [".jpg", ".jpeg"],
    png: [".png"],
    webp: [".webp"],
  };
  let metadata: Metadata;
  try {
    metadata = await sharp(file.buffer, {
      limitInputPixels: 24000000,
    }).metadata();
  } catch {
    throw new AppError(400, "Tệp không phải ảnh hợp lệ.");
  }
  if (
    !metadata.format ||
    !formats[metadata.format]?.includes(ext) ||
    file.mimetype !== `image/${metadata.format}` ||
    (metadata.pages || 1) > 1
  )
    throw new AppError(
      400,
      "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP tĩnh đúng định dạng.",
    );
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 160 ||
    metadata.height < 160
  )
    throw new AppError(400, "Ảnh cần có kích thước tối thiểu 160 × 160 px.");
  const { data, info } = await sharp(file.buffer, {
    limitInputPixels: 24000000,
  })
    .rotate()
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  const key = await provider.upload(data);
  try {
    const media = await models.media.create({
      key,
      provider: config.MEDIA_PROVIDER,
      mime: "image/webp",
      width: info.width,
      height: info.height,
      size: data.length,
      purpose,
      uploadedBy: adminId,
    });
    return { media, url: provider.getUrl(String(media._id)) };
  } catch (error) {
    await provider.delete(key);
    throw error;
  }
}
