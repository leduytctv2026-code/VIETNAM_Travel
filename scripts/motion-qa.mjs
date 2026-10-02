import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.MOTION_QA_URL || "http://localhost:3001";
const output = ".local/motion-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const result = { checks: [], errors: [], warnings: [], samples: [] };
const check = (name, pass, detail) => {
  result.checks.push({ name, pass, detail });
  console.log(pass ? "PASS" : "FAIL", name, detail ?? "");
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  await page.addInitScript(() => {
    window.__motionCLS = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) window.__motionCLS += entry.value;
      });
    }).observe({ type: "layout-shift", buffered: true });
  });
  page.on("pageerror", (error) => result.errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !/401|Failed to load resource/.test(message.text())
    )
      result.errors.push(message.text());
    if (
      message.type() === "warning" &&
      /GSAP|hydration|target.*not found/i.test(message.text())
    )
      result.warnings.push(message.text());
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator(".is-cinematic").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(
      () => {
        const img = document.querySelector(".slider-layer img");
        return img && img.complete && img.naturalWidth > 0;
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(2500);
  const cls = await page.evaluate(() => window.__motionCLS);
  check("initial layout shift stays below 0.1", cls <= 0.1, cls);
  const links = await page
    .locator('main a[href^="/"]')
    .evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute("href"))),
    ]);
  const range = (name) =>
    page.locator(`[data-scene="${name}"]`).evaluate((node) => ({
      start: Number(node.dataset.scrollStart),
      end: Number(node.dataset.scrollEnd),
    }));
  const scroll = async (y) => {
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: "instant" }),
      y,
    );
    await page.waitForTimeout(900);
  };
  const shot = (name) => page.screenshot({ path: `${output}/${name}.png` });
  const metrics = () =>
    page.evaluate(() => {
      const rect = (selector) => {
        const n = document.querySelector(selector);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          transform: getComputedStyle(n).transform,
        };
      };
      return {
        y: scrollY,
        pins: document.querySelectorAll(".pin-spacer").length,
        hero: rect(".heritage-hero"),
        camera: rect(".hero-camera"),
        intro: rect(".intro-stage"),
        track: rect(".region-panels"),
        gallery: [1, 2, 3].map((i) => rect(`.gallery-layer-${i}`)),
        map: rect(".map-camera"),
        memoryLeft: rect(".history-visual"),
        memoryRight: rect(".history-copy"),
      };
    });
  const sample = async (name) => {
    const m = await metrics();
    result.samples.push({ name, ...m });
    return m;
  };
  const initial = await sample("top");
  check("seven distinct scene pins", initial.pins === 7, initial.pins);
  await shot("after-01-hero");
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1300);
  const heroScroll = await sample("hero-wheel");
  check(
    "wheel moves document while hero remains pinned",
    heroScroll.y > 200 && Math.abs(heroScroll.hero.top) < 2,
    heroScroll.y,
  );
  check(
    "hero camera zoom actually changes",
    heroScroll.camera.width > initial.camera.width + 25,
  );
  await shot("after-02-hero-scroll");
  const introRange = await range("intro");
  await scroll(introRange.start + 400);
  const takeover = await sample("hero-intro-overlap");
  check(
    "intro covers pinned hero",
    takeover.intro.top > 20 &&
      takeover.intro.top < 700 &&
      Math.abs(takeover.hero.top) < 2,
    takeover.intro.top,
  );
  await shot("after-03-intro-overlap");
  await scroll(introRange.start + 1000);
  await shot("after-04-intro");
  const regions = await range("regions");
  await scroll(regions.start + 800);
  const r1 = await sample("region-start");
  await shot("after-05-region-start");
  await scroll(regions.start + 2700);
  const r2 = await sample("region-middle");
  check(
    "regional rail travels horizontally",
    r2.track.left < r1.track.left - 600,
    { from: r1.track.left, to: r2.track.left },
  );
  check(
    "regional viewport stays pinned",
    Math.abs(
      (await page.locator(".scene.regions .scene-pin").boundingBox()).y,
    ) < 2,
  );
  await shot("after-06-region-horizontal");
  const gallery = await range("gallery");
  await scroll(gallery.start + 850);
  const g1 = await sample("gallery-enter");
  await shot("after-07-gallery-enter");
  await scroll(gallery.start + 1400);
  const g2 = await sample("gallery-complete");
  check(
    "gallery layers have different motion",
    Math.sign(g2.gallery[0].top - g1.gallery[0].top) !==
      Math.sign(g2.gallery[1].top - g1.gallery[1].top),
  );
  await shot("after-08-gallery");
  const atlas = await range("map");
  await scroll(atlas.start + 80);
  const m1 = await sample("map-start");
  await scroll(atlas.start + 1400);
  const m2 = await sample("map-zoom");
  check("map camera zooms", m2.map.width > m1.map.width + 100);
  await shot("after-09-map");
  const memoryRange = await range("memories");
  await scroll(memoryRange.start + 400);
  const memory = await sample("memory-split");
  check(
    "memory uses opposing panel entrances",
    memory.memoryLeft.left < -20 && memory.memoryRight.left > 720,
    memory.memoryLeft.left,
  );
  await shot("after-10-memory-split");
  await scroll(memoryRange.start + 1250);
  await shot("after-11-memory");
  const culture = await range("culture");
  await scroll(culture.start + 800);
  await shot("after-12-culture-feature");
  await scroll(culture.start + 1700);
  await shot("after-13-culture-cards");
  await scroll(await page.evaluate(() => document.body.scrollHeight));
  check("footer is reachable", await page.locator("footer").isVisible());
  await shot("after-14-outro");
  check(
    "no horizontal document overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  check(
    "no production debug markers",
    (await page.locator('[class*="gsap-marker"]').count()) === 0,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
  check(
    "live reduced motion removes pins",
    (await page.locator(".pin-spacer").count()) === 0,
  );
  check(
    "live reduced motion restores all panel access",
    (await page.locator("main [inert]").count()) === 0,
  );
  await scroll(0);
  await shot("after-15-reduced-motion");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(750);
  check(
    "reenabling motion creates exactly seven pins",
    (await page.locator(".pin-spacer").count()) === 7,
  );
  await page.locator('.header a[href="/explore"]').click();
  await page.waitForURL("**/explore");
  await page.waitForTimeout(600);
  check(
    "navigation cleans up homepage pins",
    (await page.locator(".pin-spacer").count()) === 0,
  );
  await page.goBack();
  await page.locator(".is-cinematic").waitFor();
  check(
    "back navigation restores seven pins without duplicates",
    (await page.locator(".pin-spacer").count()) === 7,
  );
  await scroll(0);
  await page.locator("a.scroll-hint").click();
  await page.waitForTimeout(1000);
  check(
    "hero anchor reveals introduction",
    await page
      .locator(".intro-stage")
      .evaluate((n) => Math.abs(n.getBoundingClientRect().top) < 2),
  );
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  mobile.on("pageerror", (e) => result.errors.push(`mobile: ${e.message}`));
  await mobile.goto(base, { waitUntil: "domcontentloaded" });
  await mobile.locator(".heritage-hero").waitFor();
  await mobile.waitForTimeout(3500);
  check(
    "mobile has no pinned scenes",
    (await mobile.locator(".pin-spacer").count()) === 0,
  );
  check(
    "mobile has no horizontal overflow",
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await mobile.screenshot({ path: `${output}/mobile-01-hero.png` });
  await mobile.locator(".region-slide").first().scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: `${output}/mobile-02-regions.png` });
  await mobile.locator(".memory-scene").scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: `${output}/mobile-03-memory.png` });
  result.links = links;
  check("no JS/hydration errors", result.errors.length === 0, result.errors);
  check(
    "no missing animation targets",
    result.warnings.length === 0,
    result.warnings,
  );
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
assert.ok(
  result.checks.every((c) => c.pass),
  "Some visual motion checks failed; inspect report.json",
);
