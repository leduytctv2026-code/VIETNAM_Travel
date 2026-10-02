import { z } from "zod";
export const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const base = {
  destinationId: objectId,
  locale: z.enum(["vi", "en"]).default("vi"),
  website: z.string().max(0).optional(),
  captchaToken: z.string().max(4096).optional(),
};
export const photoSchema = z
  .object({
    ...base,
    caption: z.string().trim().max(2000).default(""),
    takenAt: z
      .string()
      .optional()
      .refine(
        (v) =>
          !v || (Number.isFinite(Date.parse(v)) && Date.parse(v) <= Date.now()),
        "Invalid date",
      ),
  })
  .strict();
export const commentSchema = z
  .object({
    ...base,
    communityPostId: objectId.optional(),
    content: z.string().trim().min(5).max(2000),
  })
  .strict();
