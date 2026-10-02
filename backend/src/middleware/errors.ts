import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/http.ts";
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let status = 500,
    message = "Dịch vụ tạm thời không khả dụng.";
  if (error instanceof AppError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof ZodError) {
    status = 400;
    message = "Vui lòng kiểm tra các trường trong biểu mẫu.";
  } else if (error instanceof multer.MulterError) {
    status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = "Ảnh không hợp lệ hoặc vượt quá giới hạn 4 MB.";
  } else if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError ||
    error instanceof mongoose.Error.StrictModeError
  ) {
    status = 400;
    message = "Dữ liệu hoặc tham chiếu không hợp lệ.";
  } else if (error instanceof mongoose.Error.VersionError) {
    status = 409;
    message = "Nội dung đã thay đổi. Vui lòng tải lại.";
  } else if (error?.code === 11000) {
    status = 409;
    message = "Slug hoặc email đã tồn tại.";
  } else if (error?.type === "entity.too.large") {
    status = 413;
    message = "Nội dung quá lớn.";
  } else if (error instanceof SyntaxError) {
    status = 400;
    message = "JSON không hợp lệ.";
  }
  if (status === 500)
    console.error(
      "API error:",
      error instanceof Error ? error.name : "unknown",
    );
  res.status(status).json({ success: false, data: null, message });
};
