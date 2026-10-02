import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config/env.js";
import { connectDatabase } from "../src/config/database.js";
import { seedDatabase } from "../src/seed.js";
import { models, User } from "../src/models/index.js";
import { createUserSession } from "../src/services/user-auth.service.js";
let mongo: MongoMemoryServer;
let app: ReturnType<typeof createApp>;
let agent: ReturnType<typeof request.agent>;
let mediaRoot: string;
let destinationId: string;
let provinceId: string;
let image: Buffer;
let postId: string;
let commentId: string;
let postImage: string;
let config: ReturnType<typeof readConfig>;
let userCookie: string;
const origin = "http://localhost:3000";
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri("heritage_integration"));
  mediaRoot = await mkdtemp(path.join(os.tmpdir(), "heritage-tests-"));
  config = readConfig({
    NODE_ENV: "test",
    JWT_SECRET: "integration-secret-that-is-long-enough-12345678",
    DATABASE_URL: mongo.getUri(),
    FRONTEND_URL: origin,
    MEDIA_ROOT: mediaRoot,
  });
  app = createApp(config);
  agent = request.agent(app);
  await seedDatabase("test@example.com", "integration-password-123", {
    includeSampleContent: true,
  });
  const member = await User.create({
    email: "member@example.com",
    name: "Linh",
  });
  userCookie = `heritage_user_session=${await createUserSession(
    { _id: member._id, sessionVersion: member.sessionVersion },
    config,
  )}`;
  const site = await models.destinations.findOne({ slug: "dai-noi-hue" });
  destinationId = String(site!._id);
  provinceId = String(site!.provinceId);
  image = await sharp({
    create: { width: 220, height: 180, channels: 3, background: "#b38f58" },
  })
    .png()
    .toBuffer();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  if (
    mediaRoot &&
    path.basename(mediaRoot).startsWith("heritage-tests-") &&
    path.dirname(mediaRoot) === path.resolve(os.tmpdir())
  )
    await rm(mediaRoot, { recursive: true, force: true });
});
describe("API-first heritage flows", () => {
  it("rejects anonymous admin requests and forged origins", async () => {
    expect((await request(app).get("/api/v1/admin/dashboard")).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .set("Origin", "https://invalid.test")
          .send({
            email: "test@example.com",
            password: "integration-password-123",
          })
      ).status,
    ).toBe(403);
  });
  it("logs in with an httpOnly JWT and hides password hashes", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .set("Origin", origin)
          .send({ email: "test@example.com", password: "wrong" })
      ).status,
    ).toBe(401);
    const response = await agent
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({
        email: "test@example.com",
        password: "integration-password-123",
      });
    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.body.data.passwordHash).toBeUndefined();
    expect((await agent.get("/api/v1/auth/me")).status).toBe(200);
  });
  it("keeps the community user profile separate from the admin session", async () => {
    const profile = await request(app)
      .get("/api/v1/auth/user/me")
      .set("Cookie", userCookie);
    expect(profile.status).toBe(200);
    expect(profile.body.data.name).toBe("Linh");
    expect((await request(app).get("/api/v1/auth/user/me")).status).toBe(401);
    const updated = await request(app)
      .patch("/api/v1/auth/user/profile")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .send({ name: "Linh Trần", bio: "Yêu di sản", location: "Huế" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Linh Trần");
    expect(updated.body.data.bio).toBe("Yêu di sản");
    expect(
      (await request(app).get("/api/v1/auth/providers")).body.data,
    ).toEqual({
      google: false,
      facebook: false,
    });
  });
  it("registers, signs in and resets a community password", async () => {
    const member = request.agent(app);
    const registered = await member
      .post("/api/v1/auth/user/register")
      .set("Origin", origin)
      .send({
        name: "Người đọc",
        email: "reader@example.com",
        password: "reader-password-123",
      });
    expect(registered.status).toBe(201);
    expect(registered.body.data.email).toBe("reader@example.com");
    expect(registered.headers["set-cookie"][0]).toContain("HttpOnly");

    const login = await request(app)
      .post("/api/v1/auth/user/login")
      .set("Origin", origin)
      .send({
        email: "reader@example.com",
        password: "reader-password-123",
      });
    expect(login.status).toBe(200);

    const forgot = await request(app)
      .post("/api/v1/auth/user/password/forgot")
      .set("Origin", origin)
      .send({ email: "reader@example.com" });
    expect(forgot.status).toBe(200);
    expect(forgot.body.data.developmentResetToken).toEqual(expect.any(String));

    const reset = await request(app)
      .post("/api/v1/auth/user/password/reset")
      .set("Origin", origin)
      .send({
        token: forgot.body.data.developmentResetToken,
        password: "updated-password-456",
      });
    expect(reset.status).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/user/login")
          .set("Origin", origin)
          .send({
            email: "reader@example.com",
            password: "reader-password-123",
          })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/user/login")
          .set("Origin", origin)
          .send({
            email: "reader@example.com",
            password: "updated-password-456",
          })
      ).status,
    ).toBe(200);
  });
  it("keeps contribution author snapshots within the legacy name limit", async () => {
    await User.updateOne(
      { email: "member@example.com" },
      { $set: { name: "N".repeat(100) } },
    );
    const response = await request(app)
      .post("/api/v1/comments")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .send({ destinationId, content: "A name-length check." });
    expect(response.status).toBe(201);
    expect(
      (await models.comments.findById(response.body.data.id))!.guestName,
    ).toHaveLength(80);
  });
  it("lets an admin update their display name without exposing password data", async () => {
    const response = await agent
      .patch("/api/v1/admin/account")
      .set("Origin", origin)
      .send({ name: "Editorial team" });
    expect(response.status).toBe(200);
    expect(response.body.data.account.name).toBe("Editorial team");
    expect(response.body.data.passwordHash).toBeUndefined();
  });
  it("serves regions, province tabs and specialty details from MongoDB", async () => {
    const regions = await request(app).get("/api/v1/regions");
    expect(regions.body.data).toHaveLength(3);
    const provinces = await request(app).get("/api/v1/provinces?limit=100");
    expect(provinces.body.data).toHaveLength(63);
    expect(provinces.body.pagination.total).toBe(63);
    const province = await request(app).get(
      "/api/v1/provinces/thua-thien-hue?lang=en",
    );
    expect(province.body.data.province.name).toBe("Thua Thien Hue");
    expect(province.body.data.province.history.summary).toContain("nguyễn");
    expect(province.body.data.destinations).toHaveLength(2);
    expect(province.body.data.specialties).toHaveLength(1);
    expect(
      (await request(app).get("/api/v1/specialties/bun-bo-hue")).body.data
        .specialty.servingGuide,
    ).toBeTruthy();
  });
  it("supports pagination, province filters, nearby geo query and random discovery", async () => {
    const list = await request(app).get(
      `/api/v1/destinations?provinceId=${provinceId}&limit=1`,
    );
    expect(list.body.data).toHaveLength(1);
    expect(list.body.pagination.total).toBe(2);
    const site = await request(app).get("/api/v1/destinations/dai-noi-hue");
    expect(site.status).toBe(200);
    expect(
      site.body.data.nearby.some(
        (p: { slug: string; distanceKm: number }) =>
          p.slug === "chua-thien-mu" && p.distanceKm > 0,
      ),
    ).toBe(true);
    expect(
      (await request(app).get("/api/v1/discover/random")).body.data.slug,
    ).toBeTruthy();
  });
  it("searches names, history and specialties with proper links", async () => {
    const response = await request(app)
      .get("/api/v1/search")
      .query({ q: "Huế", lang: "vi" });
    const kinds = response.body.data.map((p: { kind: string }) => p.kind);
    expect(kinds).toContain("provinces");
    expect(kinds).toContain("destinations");
    expect(kinds).toContain("specialties");
    expect((await request(app).get("/api/v1/provinces/not-found")).status).toBe(
      404,
    );
  });
  it("rejects injected fields and invalid upload content", async () => {
    const anonymous = await request(app)
      .post("/api/v1/comments")
      .set("Origin", origin)
      .send({ destinationId, content: "Hello world" });
    expect(anonymous.status).toBe(401);
    const bad = await request(app)
      .post("/api/v1/comments")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .send({
        destinationId,
        guestName: "Test",
        content: "Hello world",
        status: "approved",
      });
    expect(bad.status).toBe(400);
    const honeypot = await request(app)
      .post("/api/v1/comments")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .send({
        destinationId,
        content: "Hello world",
        website: "spam.example",
      });
    expect(honeypot.status).toBe(400);
    const anonymousUpload = await request(app)
      .post("/api/v1/community")
      .set("Origin", origin)
      .field("destinationId", destinationId)
      .attach("image", image, {
        filename: "anonymous.png",
        contentType: "image/png",
      });
    expect(anonymousUpload.status).toBe(401);
    const spoof = await request(app)
      .post("/api/v1/community")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .field("destinationId", destinationId)
      .attach("image", Buffer.from("<svg></svg>"), {
        filename: "fake.png",
        contentType: "image/png",
      });
    expect(spoof.status).toBe(400);
  });
  it("uploads a real image as pending, inaccessible to guests", async () => {
    const response = await request(app)
      .post("/api/v1/community")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .field("destinationId", destinationId)
      .field("caption", "Một khoảnh khắc đáng nhớ")
      .attach("image", image, {
        filename: "photo.png",
        contentType: "image/png",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("pending");
    postId = response.body.data.id;
    const pending = await models.community.findById(postId);
    postImage = pending!.image;
    expect((await request(app).get(postImage)).status).toBe(401);
    expect(
      (await request(app).get(postImage).set("Cookie", userCookie)).status,
    ).toBe(200);
    expect(
      (
        await request(app).get(
          `/api/v1/community?destinationId=${destinationId}`,
        )
      ).body.data,
    ).toHaveLength(0);
    expect((await agent.get(postImage)).headers["content-type"]).toContain(
      "image/webp",
    );
  });
  it("approves photos and publishes the normalized image and gallery record", async () => {
    const response = await agent
      .patch("/api/v1/admin/community/moderate")
      .set("Origin", origin)
      .send({ ids: [postId], action: "approve" });
    expect(response.status).toBe(200);
    expect(
      (
        await request(app).get(
          `/api/v1/community?destinationId=${destinationId}`,
        )
      ).body.data,
    ).toHaveLength(1);
    expect((await request(app).get(postImage)).status).toBe(200);
    const post = await models.community.findById(postId);
    expect(post!.moderatedAt).toBeTruthy();
    expect(post!.moderatedBy).toBeTruthy();
  });
  it("submits English comments, moderates them, and supports photo discussions", async () => {
    const response = await request(app)
      .post("/api/v1/comments")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .send({
        destinationId,
        content: "A thoughtful community perspective.",
        locale: "en",
      });
    expect(response.status).toBe(201);
    commentId = response.body.data.id;
    expect(
      (
        await request(app).get(
          `/api/v1/comments?destinationId=${destinationId}`,
        )
      ).body.data,
    ).toHaveLength(0);
    await agent
      .patch("/api/v1/admin/comments/moderate")
      .set("Origin", origin)
      .send({ ids: [commentId], action: "approve" });
    const comments = await request(app).get(
      `/api/v1/comments?destinationId=${destinationId}&lang=en`,
    );
    expect(comments.body.data[0].content).toBe(
      "A thoughtful community perspective.",
    );
    const reply = await request(app)
      .post("/api/v1/comments")
      .set("Origin", origin)
      .set("Cookie", userCookie)
      .send({
        destinationId,
        communityPostId: postId,
        content: "Một góc nhìn thật đẹp.",
      });
    expect(reply.status).toBe(201);
  });
  it("rejects previously approved contributions without exposing private media", async () => {
    await agent
      .patch("/api/v1/admin/community/moderate")
      .set("Origin", origin)
      .send({ ids: [postId], action: "reject" });
    expect((await request(app).get(postImage)).status).toBe(401);
    expect(
      (
        await request(app).get(
          `/api/v1/community?destinationId=${destinationId}`,
        )
      ).body.data,
    ).toHaveLength(0);
    await agent
      .patch("/api/v1/admin/comments/moderate")
      .set("Origin", origin)
      .send({ ids: [commentId], action: "reject" });
    expect(
      (
        await request(app).get(
          `/api/v1/comments?destinationId=${destinationId}`,
        )
      ).body.data,
    ).toHaveLength(0);
    expect(
      (await request(app).get(postImage).set("Cookie", userCookie)).status,
    ).toBe(200);
  });
  it("creates, edits and permanently deletes published destinations end-to-end", async () => {
    const payload = {
      provinceId,
      slug: "test-destination",
      name: { vi: "Địa danh kiểm thử", en: "" },
      shortDescription: { vi: "Mô tả ngắn" },
      description: { vi: "Nội dung kiểm thử" },
      location: { type: "Point", coordinates: [107.6, 16.5] },
      category: "culture",
      heroImage: "/images/image-placeholder.svg",
      status: "published",
    };
    const created = await agent
      .post("/api/v1/admin/destinations")
      .set("Origin", origin)
      .send(payload);
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    expect(
      (await request(app).get("/api/v1/destinations/test-destination?lang=en"))
        .body.data.destination.name,
    ).toBe("Địa danh kiểm thử");
    await agent
      .patch(`/api/v1/admin/destinations/${id}`)
      .set("Origin", origin)
      .send({ name: { vi: "Tên đã sửa", en: "Edited name" } });
    expect(
      (await request(app).get("/api/v1/destinations/test-destination?lang=en"))
        .body.data.destination.name,
    ).toBe("Edited name");
    await agent
      .delete(`/api/v1/admin/destinations/${id}`)
      .set("Origin", origin);
    expect(
      (await request(app).get("/api/v1/destinations/test-destination")).status,
    ).toBe(404);
    expect(await models.destinations.findById(id)).toBeNull();
  });
  it("revokes the JWT on logout and reports dashboard totals", async () => {
    const dashboard = await agent.get("/api/v1/admin/dashboard");
    expect(dashboard.body.data.counts.provinces).toBe(63);
    expect(
      (await agent.post("/api/v1/auth/logout").set("Origin", origin)).status,
    ).toBe(200);
    expect((await agent.get("/api/v1/admin/dashboard")).status).toBe(401);
  });
  it("requires the current password to rotate administrator credentials", async () => {
    const credentialAgent = request.agent(app);
    expect(
      (
        await credentialAgent
          .post("/api/v1/auth/login")
          .set("Origin", origin)
          .send({
            email: "test@example.com",
            password: "integration-password-123",
          })
      ).status,
    ).toBe(200);
    expect(
      (
        await credentialAgent
          .patch("/api/v1/admin/account")
          .set("Origin", origin)
          .send({ newPassword: "updated-password-123" })
      ).status,
    ).toBe(400);
    const changed = await credentialAgent
      .patch("/api/v1/admin/account")
      .set("Origin", origin)
      .send({
        email: "updated@example.com",
        currentPassword: "integration-password-123",
        newPassword: "updated-password-123",
      });
    expect(changed.status).toBe(200);
    expect(changed.body.data.sessionRevoked).toBe(true);
    expect((await credentialAgent.get("/api/v1/auth/me")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .set("Origin", origin)
          .send({
            email: "updated@example.com",
            password: "updated-password-123",
          })
      ).status,
    ).toBe(200);
  });
});
