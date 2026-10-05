import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("reference-sized panels fit below the header, including the complete map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 686 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("main.is-cinematic")).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.locator(".community-collection .skeleton-grid"),
  ).toHaveCount(0);
  await mkdir(".local/home-panels", { recursive: true });

  for (const name of [
    "intro",
    "regions",
    "map",
    "community",
    "discovery",
    "footer",
  ]) {
    const panel = page.locator(
      name === "footer" ? ".home-panel-footer" : `[data-scene="${name}"]`,
    );
    await panel.evaluate((element) => {
      const headerHeight =
        document.querySelector<HTMLElement>(".header")!.offsetHeight;
      window.scrollTo({
        top:
          element.getBoundingClientRect().top + window.scrollY - headerHeight,
        behavior: "instant",
      });
    });
    const bounds = await panel.evaluate((element) => {
      const headerHeight =
        document.querySelector<HTMLElement>(".header")!.offsetHeight;
      const rect = element.getBoundingClientRect();
      const stage =
        element.querySelector<HTMLElement>(".scene-stage") || element;
      return {
        top: rect.top,
        bottom: rect.bottom,
        headerHeight,
        viewportHeight: innerHeight,
        contentHeight: stage.scrollHeight,
        availableHeight: stage.clientHeight,
      };
    });
    expect(Math.abs(bounds.top - bounds.headerHeight)).toBeLessThan(2);
    expect(Math.abs(bounds.bottom - bounds.viewportHeight)).toBeLessThan(2);
    expect(bounds.contentHeight).toBeLessThanOrEqual(
      bounds.availableHeight + 2,
    );
    if (name === "map") {
      const mapBounds = await panel
        .locator(".map-frame")
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            viewport: innerHeight,
          };
        });
      expect(mapBounds.height).toBeGreaterThan(180);
      expect(mapBounds.bottom).toBeLessThan(mapBounds.viewport - 12);
    }
    if (name === "regions") {
      await expect
        .poll(() =>
          panel
            .locator("img")
            .evaluateAll((images) =>
              images.every((image) => (image as HTMLImageElement).complete),
            ),
        )
        .toBe(true);
    }
    await page.screenshot({ path: `.local/home-panels/${name}.png` });
  }
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  for (const viewport of [
    { width: 1366, height: 686 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`homepage wheel moves one stop in both directions (${viewport.width}px, ${reducedMotion})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await expect(page.locator("main.is-cinematic")).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.locator(".community-collection .skeleton-grid"),
      ).toHaveCount(0);
      await page.mouse.move(100, 40);

      const layout = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(".header")!;
        return {
          pageHeight: window.innerHeight - header.offsetHeight,
          intro:
            document
              .querySelector('[data-scene="intro"]')!
              .getBoundingClientRect().top +
            window.scrollY -
            header.offsetHeight,
          scenes: [
            ...document.querySelectorAll<HTMLElement>("main > [data-scene]"),
            document.querySelector<HTMLElement>(".site-footer")!,
          ]
            .filter((scene) => scene.offsetHeight > 0)
            .map((scene) =>
              Math.max(
                0,
                scene.getBoundingClientRect().top +
                  window.scrollY -
                  header.offsetHeight,
              ),
            ),
        };
      });
      const settleMs = reducedMotion === "reduce" ? 260 : 650;
      const position = () => page.evaluate(() => window.scrollY);

      // Momentum must not carry a single gesture past the next stop.
      await page.locator(".header").evaluate((header) => {
        for (const deltaY of [100, 60, 30]) {
          header.dispatchEvent(
            new WheelEvent("wheel", {
              deltaY,
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      });
      await page.waitForTimeout(settleMs);
      expect(Math.abs((await position()) - layout.intro)).toBeLessThan(9);
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(settleMs);
      expect(await position()).toBeLessThan(9);

      const visited: number[] = [0];
      for (let step = 0; step < 60; step++) {
        const before = await position();
        const max = await page.evaluate(
          () => document.documentElement.scrollHeight - innerHeight,
        );
        if (before >= max - 8) break;
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(settleMs);
        const after = await position();
        expect(after).toBeGreaterThan(before + 8);
        // Every stop must be a named panel boundary, never a generated mid-panel stop.
        expect(
          layout.scenes.some((top) => Math.abs(Math.min(top, max) - after) < 9),
        ).toBe(true);
        visited.push(after);
      }
      const max = await page.evaluate(
        () => document.documentElement.scrollHeight - innerHeight,
      );
      expect(Math.abs((await position()) - max)).toBeLessThan(9);
      for (const sceneTop of layout.scenes) {
        expect(
          visited.some((stop) => Math.abs(stop - Math.min(sceneTop, max)) < 9),
        ).toBe(true);
      }

      // The same panel boundaries must work on the return journey.
      for (const expected of visited.slice(0, -1).reverse()) {
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(settleMs);
        expect(Math.abs((await position()) - expected)).toBeLessThan(9);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("homepage wheel preserves dialogs, map controls and native scrolling after navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.is-cinematic")).toBeAttached();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const beforeDialog = await page.evaluate(() => window.scrollY);
  await page.mouse.move(100, 40);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(260);
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeDialog);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đóng", exact: true })
    .click();

  const map = page.locator(".leaflet-container").first();
  await map.scrollIntoViewIfNeeded();
  const beforeMap = await page.evaluate(() => window.scrollY);
  const prevented = await map.evaluate((element) => {
    const wheel = new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(wheel);
    return wheel.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(beforeMap);

  await page.locator('.header a[href="/explore"]').click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator(".place-grid .place-card").first()).toBeVisible();
  await expect(page.locator("main.cinematic-home")).toHaveCount(0);
  await page.mouse.move(100, 40);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(10);
});
