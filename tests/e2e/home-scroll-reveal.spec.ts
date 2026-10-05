import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.describe.configure({ mode: "parallel" });

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.is-cinematic")).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.locator(".community-collection .skeleton-grid"),
  ).toHaveCount(0);
}

async function scrollToScene(page: Page, name: string) {
  await page.locator(`[data-scene="${name}"]`).evaluate((element) => {
    window.scrollTo({
      top:
        element.getBoundingClientRect().top +
        scrollY -
        document.querySelector<HTMLElement>(".header")!.offsetHeight,
      behavior: "instant",
    });
  });
}

for (const width of [1440, 1366, 1280, 1024, 768, 430, 390, 375]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`editorial reveal stays once-only and overflow-free (${width}px, ${reducedMotion})`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      await page.emulateMedia({ reducedMotion });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await ready(page);

      const intro = page.locator('[data-scene="intro"] .intro-strip > p');
      const footer = page.locator(".footer-wordmark");
      if (reducedMotion === "no-preference") {
        await expect(intro).toHaveAttribute("data-reveal", "pending");
        await expect(footer).toHaveAttribute("data-reveal", "pending");
        await expect(footer).toHaveCSS("opacity", "0");
      } else {
        await expect(intro).toHaveAttribute("data-reveal", "revealed");
        await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
      }

      const before = await page
        .locator("main > [data-scene]")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            height: (element as HTMLElement).offsetHeight,
            top: (element as HTMLElement).offsetTop,
          })),
        );
      await page.evaluate(() => {
        const state = window as typeof window & { revealCLS: number };
        state.revealCLS = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.revealCLS += (
              entry as PerformanceEntry & { value: number }
            ).value;
          }
        }).observe({ type: "layout-shift" });
      });
      const scenes = await page
        .locator("main > [data-scene]")
        .evaluateAll((elements) =>
          elements
            .filter((element) => (element as HTMLElement).offsetHeight > 0)
            .map((element) => element.getAttribute("data-scene")!),
        );

      for (const scene of scenes) {
        await scrollToScene(page, scene);
        // The page can be much taller than one viewport on phones. Visit each
        // native target to also exercise overflow-scrolling history timelines.
        const targets = page.locator(`[data-scene="${scene}"] [data-reveal]`);
        for (const target of await targets.all()) {
          if (!(await target.isVisible())) continue;
          await target.scrollIntoViewIfNeeded();
          await expect(target).toHaveAttribute("data-reveal", "revealed");
          if (reducedMotion === "no-preference")
            await expect(target).toHaveAttribute("data-reveal-count", "1");
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        // Existing CSS positioning/hover must be restored, not left as inline
        // transforms or permanent compositor layers after the entrance.
        expect(
          await targets.evaluateAll((elements) =>
            elements.every(
              (element) => !(element as HTMLElement).style.willChange,
            ),
          ),
        ).toBe(true);
      }

      for (const target of await page
        .locator(".home-panel-footer [data-reveal]")
        .all()) {
        if (!(await target.isVisible())) continue;
        await target.scrollIntoViewIfNeeded();
        await expect(target).toHaveAttribute("data-reveal", "revealed");
      }
      await mkdir(".local/scroll-reveal", { recursive: true });
      await page.screenshot({
        path: `.local/scroll-reveal/${width}-${reducedMotion}-footer.png`,
      });
      const after = await page
        .locator("main > [data-scene]")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            height: (element as HTMLElement).offsetHeight,
            top: (element as HTMLElement).offsetTop,
          })),
        );
      expect(after).toEqual(before);
      expect(
        await page.evaluate(
          () => (window as typeof window & { revealCLS: number }).revealCLS,
        ),
      ).toBeLessThan(0.01);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);

      for (const scene of scenes.slice().reverse())
        await scrollToScene(page, scene);
      expect(
        await page
          .locator("[data-reveal-count]")
          .evaluateAll((elements) =>
            elements.every(
              (element) => element.getAttribute("data-reveal-count") === "1",
            ),
          ),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test("reveals preserve map drag/zoom, card hover, sharing, random discovery and live reduce motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 686 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await scrollToScene(page, "regions");
  const card = page.locator(".region-slide").first();
  await expect(card).toHaveAttribute("data-reveal", "revealed");
  const image = card.locator(".region-image-motion img");
  const original = await image.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await card.hover();
  await expect
    .poll(() =>
      image.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(original);
  await expect(card.locator("a")).toHaveAttribute(
    "href",
    /\/explore\?regionId=/,
  );

  await scrollToScene(page, "map");
  await expect(page.locator(".map-frame")).toHaveAttribute(
    "data-reveal",
    "revealed",
  );
  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible();
  const frame = await page.locator(".map-frame").boundingBox();
  expect(frame!.y + frame!.height).toBeLessThan(686 - 12);
  const mapPane = map.locator(".leaflet-map-pane");
  const initial = await mapPane.getAttribute("style");
  const box = await map.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 90,
    box!.y + box!.height / 2 + 30,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(mapPane).not.toHaveAttribute("style", initial!);
  const tiles = map.locator(".leaflet-tile-container").first();
  const oldZoom = await tiles.getAttribute("style");
  await map.locator(".leaflet-control-zoom-in").click();
  await expect
    .poll(() =>
      map.locator(".leaflet-tile-container").first().getAttribute("style"),
    )
    .not.toBe(oldZoom);
  expect(await map.locator(".leaflet-marker-icon").count()).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect
    .poll(() => map.evaluate((element) => element.clientWidth))
    .toBeGreaterThan(900);
  await expect(page.locator(".map-atlas-link")).toHaveAttribute("href", "/map");

  await scrollToScene(page, "community");
  await page.locator(".gallery-actions > button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đóng", exact: true })
    .click();
  await scrollToScene(page, "discovery");
  await page.locator(".random-discovery > button").click();
  await expect(page.locator(".random-result")).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.locator('[data-reveal="pending"], [data-reveal="revealing"]'),
  ).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
  await page.locator('.header a[href="/explore"]').click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator("[data-reveal]")).toHaveCount(0);
});

test("an empty community response arriving inside the viewport reveals once", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let respond: (() => void) | undefined;
  const released = new Promise<void>((resolve) => {
    respond = resolve;
  });
  await page.route("**/api/v1/community?**", async (route) => {
    await released;
    await route.fulfill({
      json: {
        success: true,
        data: [],
        pagination: { page: 1, pages: 0, total: 0, limit: 6 },
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("main.is-cinematic")).toBeAttached();
  await scrollToScene(page, "community");
  await expect(
    page.locator(".community-collection .skeleton-grid"),
  ).toBeVisible();
  respond!();
  const empty = page.locator(".gallery-empty");
  await expect(empty).toHaveAttribute("data-reveal", "revealed");
  await expect(empty).toHaveAttribute("data-reveal-count", "1");
  await scrollToScene(page, "discovery");
  await scrollToScene(page, "community");
  await expect(empty).toHaveAttribute("data-reveal-count", "1");
});
