import mongoose, { Schema } from "mongoose";
const text = (max: number, required = false) => ({
  type: String,
  trim: true,
  required,
  maxlength: max,
});
const translation = (max: number, required = true) => ({
  type: new Schema(
    { vi: text(max, required), en: { ...text(max), default: "" } },
    { _id: false, strict: "throw" },
  ),
  required,
  default: required ? undefined : () => ({ vi: "", en: "" }),
});
const image = {
  ...text(2048, true),
  validate: {
    validator: (v: string) =>
      !v ||
      /^\/api\/v1\/media\/[a-f\d]{24}$/.test(v) ||
      /^\/images\/[a-zA-Z0-9._-]+$/.test(v) ||
      /^https:\/\/[^\s]+$/.test(v),
    message: "Invalid image path",
  },
};
const point = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) =>
          v.length === 2 &&
          Number.isFinite(v[0]) &&
          Number.isFinite(v[1]) &&
          Math.abs(v[0]) <= 180 &&
          Math.abs(v[1]) <= 90,
        message: "Expected [longitude, latitude]",
      },
    },
  },
  { _id: false, strict: "throw" },
);
const event = new Schema(
  {
    year: text(40, true),
    title: translation(200),
    description: translation(5000),
    image: { ...image, required: false },
    source: { ...text(2048), match: /^(?:https:\/\/[^\s]+)?$/ },
  },
  { _id: false, strict: "throw" },
);
const history = new Schema(
  {
    summary: translation(20000, false),
    events: { type: [event], default: [] },
    beforeImage: { ...image, required: false },
    afterImage: { ...image, required: false },
  },
  { _id: false, strict: "throw" },
);
const geography = new Schema(
  {
    description: translation(15000, false),
    terrain: translation(5000, false),
    climate: translation(5000, false),
    boundaries: translation(5000, false),
    areaKm2: { type: Number, min: 0 },
  },
  { _id: false, strict: "throw" },
);
const seo = new Schema(
  { title: translation(160, false), description: translation(400, false) },
  { _id: false, strict: "throw" },
);
const source = new Schema(
  {
    title: text(200, true),
    url: { ...text(2048, true), match: /^https:\/\// },
  },
  { _id: false, strict: "throw" },
);
const base = {
  name: translation(160),
  slug: {
    ...text(120, true),
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    unique: true,
  },
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
    required: true,
  },
  deletedAt: { type: Date, default: null },
  isSample: { type: Boolean, default: false },
  sources: { type: [source], default: [] },
  seo: { type: seo, default: () => ({}) },
};
const options = {
  timestamps: true,
  strict: "throw" as const,
  optimisticConcurrency: true,
};
const ref = (model: string, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required,
});
const region = new Schema(
  {
    ...base,
    description: translation(10000),
    heroImage: image,
    order: { type: Number, default: 0, min: 0 },
  },
  options,
);
region.index({ status: 1, deletedAt: 1, order: 1 });
const province = new Schema(
  {
    ...base,
    regionId: ref("Region"),
    shortDescription: translation(2000),
    overview: translation(15000),
    culture: translation(10000, false),
    people: translation(10000, false),
    history: { type: history, default: () => ({}) },
    geography: { type: geography, default: () => ({}) },
    coordinates: { type: point, required: false },
    heroImage: { ...image, required: false },
    gallery: { type: [image], default: [] },
    fact: translation(2000, false),
    factSource: { ...text(2048), match: /^(?:https:\/\/[^\s]+)?$/ },
  },
  options,
);
province.index({ regionId: 1, status: 1, deletedAt: 1 });
province.index({ coordinates: "2dsphere" });
const destination = new Schema(
  {
    ...base,
    provinceId: ref("Province"),
    shortDescription: translation(2000),
    description: translation(15000),
    history: { type: history, default: () => ({}) },
    culturalValue: translation(10000, false),
    geography: { type: geography, default: () => ({}) },
    address: translation(2000, false),
    location: { type: point, required: true },
    category: {
      type: String,
      enum: ["nature", "heritage", "culture", "museum"],
      required: true,
    },
    heroImage: image,
    officialGallery: { type: [image], default: [] },
  },
  options,
);
destination.index({ location: "2dsphere" });
destination.index({ provinceId: 1, status: 1, deletedAt: 1, category: 1 });
const specialty = new Schema(
  {
    ...base,
    provinceId: ref("Province"),
    description: translation(10000),
    origin: translation(5000, false),
    culturalStory: translation(10000, false),
    characteristics: translation(5000, false),
    servingGuide: translation(5000, false),
    images: {
      type: [image],
      validate: {
        validator: (v: string[]) => v.length >= 1 && v.length <= 12,
        message: "1–12 images required",
      },
    },
  },
  options,
);
specialty.index({ provinceId: 1, status: 1, deletedAt: 1 });
for (const schema of [region, province, destination, specialty])
  schema.index(
    {
      "name.vi": "text",
      "name.en": "text",
      "description.vi": "text",
      "description.en": "text",
      "overview.vi": "text",
      "overview.en": "text",
      "history.summary.vi": "text",
      "history.summary.en": "text",
    },
    { default_language: "none", weights: { "name.vi": 10, "name.en": 10 } },
  );
const moderation = {
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    required: true,
  },
  moderatedBy: ref("Admin", false),
  moderatedAt: Date,
  deletedAt: { type: Date, default: null },
};
const post = new Schema(
  {
    destinationId: ref("Destination"),
    // Kept optional so existing community posts remain valid after accounts
    // are introduced. New submissions always receive the signed-in user id.
    authorId: ref("User", false),
    guestName: text(80, true),
    caption: translation(2000, false),
    image: { ...image },
    mediaId: ref("Media"),
    takenAt: Date,
    originalLocale: { type: String, enum: ["vi", "en"], default: "vi" },
    ...moderation,
  },
  options,
);
post.index({ destinationId: 1, status: 1, deletedAt: 1, createdAt: -1 });
post.index({ status: 1, deletedAt: 1, createdAt: -1 });
const comment = new Schema(
  {
    destinationId: ref("Destination"),
    communityPostId: ref("CommunityPost", false),
    // Kept optional for comments submitted before user accounts existed.
    authorId: ref("User", false),
    guestName: text(80, true),
    content: translation(2000, false),
    originalLocale: { type: String, enum: ["vi", "en"], default: "vi" },
    ...moderation,
  },
  options,
);
comment.index({
  destinationId: 1,
  communityPostId: 1,
  status: 1,
  deletedAt: 1,
  createdAt: -1,
});
comment.index({ status: 1, deletedAt: 1, createdAt: -1 });
const admin = new Schema(
  {
    email: { ...text(254, true), lowercase: true, unique: true },
    name: text(100, true),
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin"], default: "admin" },
    sessionVersion: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  options,
);
const user = new Schema(
  {
    // Facebook can legitimately withhold an email address, so this remains
    // optional. The linked provider identity is the authoritative key.
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    name: text(100, true),
    // OAuth-only accounts intentionally have no local password.
    passwordHash: { type: String, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: "",
      validate: {
        validator: (value: string) =>
          !value || /^https:\/\/[^\s]+$/.test(value),
        message: "Invalid avatar URL",
      },
    },
    bio: { type: String, trim: true, maxlength: 500, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    locale: { type: String, enum: ["vi", "en"], default: "vi" },
    sessionVersion: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  options,
);
// Sparse allows providers that do not return an email address.
user.index({ email: 1 }, { unique: true, sparse: true });
const oauthAccount = new Schema(
  {
    userId: ref("User"),
    provider: { type: String, enum: ["google", "facebook"], required: true },
    providerAccountId: text(255, true),
    providerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
    },
  },
  options,
);
oauthAccount.index({ provider: 1, providerAccountId: 1 }, { unique: true });
const media = new Schema(
  {
    key: text(200, true),
    provider: { type: String, enum: ["local", "s3"], required: true },
    mime: { type: String, enum: ["image/webp"], required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    size: { type: Number, required: true },
    purpose: { type: String, enum: ["official", "community"], required: true },
    uploadedBy: ref("Admin", false),
    deletedAt: { type: Date, default: null },
  },
  options,
);
media.index({ purpose: 1, deletedAt: 1, createdAt: -1 });
const rate = new Schema({ _id: String, count: Number, expiresAt: Date });
rate.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const models = {
  regions: mongoose.models.Region || mongoose.model("Region", region),
  provinces: mongoose.models.Province || mongoose.model("Province", province),
  destinations:
    mongoose.models.Destination || mongoose.model("Destination", destination),
  specialties:
    mongoose.models.Specialty || mongoose.model("Specialty", specialty),
  community:
    mongoose.models.CommunityPost ||
    mongoose.model("CommunityPost", post, "community_posts"),
  comments: mongoose.models.Comment || mongoose.model("Comment", comment),
  media: mongoose.models.Media || mongoose.model("Media", media),
};
export const Admin = mongoose.models.Admin || mongoose.model("Admin", admin);
export const User = mongoose.models.User || mongoose.model("User", user);
export const OAuthAccount =
  mongoose.models.OAuthAccount || mongoose.model("OAuthAccount", oauthAccount);
export const RateBucket =
  mongoose.models.RateBucket || mongoose.model("RateBucket", rate);
export type Collection = keyof typeof models;
export type ContentCollection =
  "regions" | "provinces" | "destinations" | "specialties";
export const contentCollections: ContentCollection[] = [
  "regions",
  "provinces",
  "destinations",
  "specialties",
];
