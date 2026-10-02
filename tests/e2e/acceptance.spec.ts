import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

async function login(page: Page) {
  await page.goto("/admin");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Đăng xuất", exact: true }),
  ).toBeVisible();
}
test("discovery, five separate tabs, search keyboard and bilingual content", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator('a[href^="/explore?regionId="]').first().click();
  await page.locator('a[href^="/province/"]').first().click();
  await expect(page.getByRole("tab")).toHaveCount(5);
  for (const name of [
    "Lịch sử",
    "Địa lý",
    "Đặc sản",
    "Địa danh",
    "Tổng quan",
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
  }
  await page.getByRole("tab", { name: "Địa danh", exact: true }).click();
  await page
    .getByRole("tabpanel")
    .locator('a[href^="/destination/"]')
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Đăng nhập để bình luận", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tìm kiếm toàn bộ di sản" }).click();
  await page.getByRole("combobox").fill("Huế");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await expect(page).toHaveURL(/\/province\/hue/);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "History", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("map filter, cluster, fly-to and destination popup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/map");
  await page
    .getByRole("combobox", { name: "Tỉnh thành", exact: true })
    .selectOption({ label: "Huế" });
  await expect(page.locator(".map-list article")).toHaveCount(2);
  await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
  await page.locator(".map-list article button").first().click();
  await expect(page.locator(".leaflet-popup-content")).toBeVisible();
  await page.locator(".leaflet-popup-content a").click();
  await expect(page).toHaveURL(/\/destination\//);
  expect(errors).toEqual([]);
});

test("community contributions require a signed-in user", async ({ page }) => {
  await page.goto("/community");
  await page
    .getByRole("button", { name: "Chia sẻ hình ảnh", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập để chia sẻ." }),
  ).toBeVisible();
  const response = await page.request.post("/api/v1/comments", {
    headers: { Origin: process.env.E2E_BASE_URL || "http://localhost:3000" },
    data: {
      destinationId: "000000000000000000000000",
      content: "A signed-in account is required.",
    },
  });
  expect(response.status()).toBe(401);
});

test("community auth exposes sign-up, recovery and branded social providers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const google = dialog.getByRole("button", { name: /Google/ });
  const facebook = dialog.getByRole("button", { name: /Facebook/ });
  await expect(google.locator(".auth-provider-icon")).toBeVisible();
  await expect(facebook.locator(".auth-provider-icon")).toBeVisible();
  await mkdir(".local/screenshots", { recursive: true });
  await page.screenshot({
    path: ".local/screenshots/community-auth-social.png",
    fullPage: false,
  });

  await dialog.getByRole("tab", { name: "Đăng ký" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Tạo tài khoản." }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Tên hiển thị")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Tạo tài khoản" }),
  ).toBeVisible();

  await dialog.getByRole("tab", { name: "Đăng nhập" }).click();
  await dialog.getByRole("button", { name: "Quên mật khẩu?" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Tìm lại mật khẩu." }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Gửi hướng dẫn" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/screenshots/community-auth-dialog.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test.skip("legacy guest upload and comment moderation flow", async ({
  page,
  browser,
}) => {
  const id = `E2E-${Date.now()}`;
  const adminContext = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
  });
  const admin = await adminContext.newPage();
  let photoId = "";
  let commentId = "";
  let mediaId = "";
  const headers = {
    Origin: process.env.E2E_BASE_URL || "http://localhost:3000",
  };
  try {
    await login(admin);
    await page.goto("/destination/dai-noi-hue");
    await page
      .getByRole("button", { name: "Chia sẻ hình ảnh", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên của bạn").fill(id);
    const image = await sharp({
      create: { width: 240, height: 240, channels: 3, background: "#2C402E" },
    })
      .png()
      .toBuffer();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "acceptance.png",
      mimeType: "image/png",
      buffer: image,
    });
    await dialog
      .getByLabel("Câu chuyện phía sau")
      .fill("Ảnh kiểm thử tự động, không phải tư liệu địa danh.");
    const uploaded = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/community") &&
        r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /Gửi để xét duyệt/ }).click();
    const result = await (await uploaded).json();
    expect(result.success).toBe(true);
    photoId = result.data.id;
    expect(result.data.status).toBe("pending");
    await expect(
      dialog.getByRole("heading", { name: "Cảm ơn góc nhìn của bạn." }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Tiếp tục khám phá" }).click();
    await expect(
      page.getByRole("button", { name: `Mở ảnh của ${id}` }),
    ).toHaveCount(0);
    const discussion = page.locator(".discussion form");
    await discussion.getByLabel("Tên của bạn").fill(id);
    await discussion.getByLabel("Bình luận").fill(`Thảo luận kiểm thử ${id}`);
    const commented = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/comments") && r.request().method() === "POST",
    );
    await discussion
      .getByRole("button", { name: "Gửi bình luận", exact: true })
      .click();
    const comment = await (await commented).json();
    expect(comment.success).toBe(true);
    commentId = comment.data.id;
    expect(comment.data.status).toBe("pending");
    await expect(discussion.getByRole("status")).toContainText(
      "đang chờ duyệt",
    );
    await admin.getByRole("button", { name: /Ảnh cộng đồng/ }).click();
    await admin.getByRole("textbox", { name: "Tìm nội dung" }).fill(id);
    const photo = admin.locator(".admin-record").filter({ hasText: id });
    await expect(photo).toHaveCount(1);
    const pending = await (
      await admin.request.get(`/api/v1/admin/community?q=${id}`)
    ).json();
    mediaId = pending.data[0].mediaId;
    await photo.getByRole("button", { name: "Duyệt", exact: true }).click();
    await expect(photo).toHaveCount(0);
    await admin.getByRole("button", { name: /^Bình luận/ }).click();
    await admin.getByRole("textbox", { name: "Tìm nội dung" }).fill(id);
    const row = admin.locator(".admin-record").filter({ hasText: id });
    await row.getByRole("button", { name: "Duyệt", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.reload();
    await expect(
      page.locator(".comment").filter({ hasText: id }),
    ).toBeVisible();
    await page.getByRole("button", { name: `Mở ảnh của ${id}` }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    if (commentId)
      await admin.request.delete(`/api/v1/admin/comments/${commentId}`, {
        headers,
      });
    if (photoId)
      await admin.request.delete(`/api/v1/admin/community/${photoId}`, {
        headers,
      });
    if (mediaId)
      await admin.request.delete(`/api/v1/admin/media/${mediaId}`, { headers });
    await adminContext.close();
  }
});

test("admin creates, edits and deletes a destination through the interface", async ({
  page,
}) => {
  const slug = `e2e-editorial-${Date.now()}`;
  await login(page);
  await page
    .getByRole("button", { name: "Địa danh · Official Gallery", exact: true })
    .click();
  await page.getByRole("button", { name: /Thêm nội dung/ }).click();
  const form = page.locator(".content-editor");
  await form.getByLabel("Slug", { exact: true }).fill(slug);
  await form
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("published");
  await form
    .getByRole("combobox", { name: "Tỉnh thành", exact: true })
    .selectOption({ label: "Huế" });
  for (const field of await form.locator("fieldset").all()) {
    const vi = field.getByLabel("Tiếng Việt", { exact: true });
    if (await vi.count()) await vi.fill(`Nội dung mẫu kiểm thử ${slug}`);
  }
  await form
    .getByLabel("Ảnh bìa", { exact: true })
    .fill("/images/image-placeholder.svg");
  await form.getByLabel("Đánh dấu dữ liệu mẫu", { exact: true }).check();
  await form.getByRole("button", { name: "Lưu nội dung", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole("textbox", { name: "Tìm nội dung" }).fill(slug);
  const record = page.locator(".admin-record").filter({ hasText: slug });
  await expect(record).toHaveCount(1);
  const publicPage = await page.context().newPage();
  await publicPage.goto(`/destination/${slug}`);
  await expect(publicPage.locator("h1")).toContainText(slug);
  await record.getByRole("button", { name: "Sửa", exact: true }).click();
  await form
    .getByRole("group", { name: "Tên địa danh", exact: true })
    .getByLabel("Tiếng Việt")
    .fill(`Đã cập nhật ${slug}`);
  await form.getByRole("button", { name: "Lưu nội dung", exact: true }).click();
  await expect(form).toHaveCount(0);
  await publicPage.reload();
  await expect(publicPage.locator("h1")).toContainText(`Đã cập nhật ${slug}`);
  await record.getByRole("button", { name: "Xóa", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận xóa" })
    .click();
  await expect(record).toHaveCount(0);
  await publicPage.close();
});

test("admin login keeps its editorial split layout responsive and hydrated", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const recordErrors = (target: Page) => {
    target.on("pageerror", (error) => browserErrors.push(error.message));
    target.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|did not match|uncaught|runtime error/i.test(message.text())
      )
        browserErrors.push(message.text());
    });
  };
  recordErrors(page);

  await mkdir(".local/screenshots", { recursive: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bàn biên tập." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập quản trị" }),
  ).toBeVisible();
  await expect(page.locator(".admin-login-photo img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".admin-login-photo img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".admin-login-submit")).toBeEnabled();

  const photoRatio = () =>
    page.evaluate(() => {
      const main = document.querySelector(".admin-main--login")!;
      const photo = document.querySelector(".admin-login-photo")!;
      return (
        photo.getBoundingClientRect().width / main.getBoundingClientRect().width
      );
    });
  await expect.poll(photoRatio).toBeGreaterThan(0.55);
  await expect.poll(photoRatio).toBeLessThan(0.59);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);

  const password = page.getByLabel("Mật khẩu", { exact: true });
  await password.fill("preview-password");
  await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.waitForTimeout(1100);
  await page.screenshot({
    path: ".local/screenshots/admin-login-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Email", { exact: true }).fill("invalid-email");
  await page.locator(".admin-login-submit").click();
  await expect(page.locator(".admin-login-error")).toBeVisible();

  const mobile = await page.context().newPage();
  recordErrors(mobile);
  await mobile.emulateMedia({ reducedMotion: "no-preference" });
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto("/admin");
  await expect(mobile.locator(".admin-login-photo img")).toBeVisible();
  await expect
    .poll(() =>
      mobile
        .locator(".admin-login-photo img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await mobile
    .locator(".admin-login-photo img")
    .evaluate((image: HTMLImageElement) => image.decode());
  await mobile.waitForTimeout(2000);
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await expect(mobile.getByLabel("Email", { exact: true })).toBeVisible();
  const mobileOrder = await mobile.evaluate(() => {
    const photo = document.querySelector(".admin-login-photo")!;
    const form = document.querySelector(".admin-login")!;
    return {
      photoBottom: photo.getBoundingClientRect().bottom,
      formTop: form.getBoundingClientRect().top,
    };
  });
  expect(mobileOrder.photoBottom).toBeLessThanOrEqual(mobileOrder.formTop);
  expect(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mobile.screenshot({
    path: ".local/screenshots/admin-login-mobile.png",
    fullPage: true,
  });
  await mobile.close();

  expect(browserErrors).toEqual([]);
});

test("desktop and mobile layouts, reduced motion and no horizontal overflow", async ({
  page,
}) => {
  await mkdir(".local/screenshots", { recursive: true });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({ path: ".local/screenshots/home-desktop.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of [
    "/",
    "/province/thua-thien-hue",
    "/destination/dai-noi-hue",
    "/map",
    "/community",
    "/admin",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      route,
    ).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await expect(
    page.getByRole("navigation", { name: "Điều hướng chính" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await page.screenshot({ path: ".local/screenshots/home-mobile.png" });
});
