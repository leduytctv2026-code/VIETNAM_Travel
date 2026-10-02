import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.MOTION_QA_URL || "http://localhost:3001";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const checks = [];
const errors = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(pass ? "PASS" : "FAIL", name, detail ?? "");
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator(".is-cinematic").waitFor();
  await page.waitForTimeout(2200);
  check(
    "debug markers removed after verification",
    (await page.locator(".gsap-marker-start").count()) === 0,
  );
  const ranges = await page
    .locator("[data-scroll-start]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        name: n.dataset.scene,
        start: Number(n.dataset.scrollStart),
        end: Number(n.dataset.scrollEnd),
      })),
    );
  check(
    "each outgoing pin overlaps next scene by 765px",
    ranges
      .slice(0, -1)
      .every((r, i) => Math.abs(r.end - ranges[i + 1].start - 765) <= 2),
    ranges,
  );
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator(".is-cinematic").waitFor();
  await page.waitForTimeout(2200);
  const seen = new Set();
  const badFocus = [];
  await page.keyboard.press("Tab");
  for (let i = 0; i < 58; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(130);
    const focus = await page.evaluate(() => {
      const n = document.activeElement;
      const scene = n?.closest("[data-scene]");
      if (!scene) return null;
      const r = n.getBoundingClientRect();
      const c = getComputedStyle(n);
      return {
        scene: scene.dataset.scene,
        text: n.textContent?.slice(0, 60),
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        visibility: c.visibility,
      };
    });
    if (focus) {
      seen.add(focus.scene);
      if (
        focus.right < 0 ||
        focus.left > 1440 ||
        focus.bottom < 80 ||
        focus.top > 900 ||
        focus.visibility === "hidden"
      )
        badFocus.push(focus);
    }
  }
  check(
    "keyboard reaches regional/gallery/map/memory/culture links",
    ["regions", "gallery", "map", "memories", "culture"].every((s) =>
      seen.has(s),
    ),
    [...seen],
  );
  check(
    "keyboard focus never stranded outside viewport",
    badFocus.length === 0,
    badFocus,
  );
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.waitForTimeout(1300);
  check(
    "desktop resize does not duplicate pins",
    (await page.locator(".pin-spacer").count()) === 7,
  );
  const region = await page
    .locator('[data-scene="regions"]')
    .evaluate((n) => Number(n.dataset.scrollStart));
  await page.evaluate(
    (y) => scrollTo({ top: y, behavior: "instant" }),
    region + 1100,
  );
  await page.waitForTimeout(1000);
  check(
    "resized region CTA remains inside viewport",
    await page
      .locator(".region-panel-copy")
      .first()
      .evaluate((n) => n.getBoundingClientRect().bottom <= innerHeight),
  );
  await page.screenshot({ path: ".local/motion-qa/desktop-1100.png" });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(700);
  check(
    "tablet removes all pins",
    (await page.locator(".pin-spacer").count()) === 0,
  );
  check(
    "tablet no overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(700);
  check(
    "desktop restored once after tablet",
    (await page.locator(".pin-spacer").count()) === 7,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(400);
  check(
    "reduced motion shows every regional card in document flow",
    await page.locator(".region-panel").evaluateAll((nodes) =>
      nodes.every((n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1;
      }),
    ),
  );
  const report = JSON.parse(
    await readFile(".local/motion-qa/report.json", "utf8"),
  );
  const detailLinks = ["/destination/", "/province/", "/specialty/"]
    .map((prefix) => report.links.find((path) => path.startsWith(prefix)))
    .filter(Boolean);
  const routes = [
    "/explore",
    "/destinations",
    "/specialties",
    "/map",
    "/community",
    "/profile",
    "/admin",
    ...detailLinks,
  ];
  for (const route of routes) {
    const response = await page.goto(base + route, {
      waitUntil: "domcontentloaded",
    });
    await page.locator('main:not([aria-label="Loading atlas"])').waitFor();
    await page.waitForTimeout(450);
    const state = await page.evaluate(() => ({
      heading: document.querySelector("h1,h2")?.textContent,
      pins: document.querySelectorAll(".pin-spacer").length,
      width: document.documentElement.scrollWidth,
    }));
    check(
      `route ${route}`,
      response.status() === 200 &&
        state.pins === 0 &&
        !/Chưa thể mở|temporarily unavailable/.test(state.heading || ""),
      state.heading,
    );
  }
  check("no uncaught browser errors", errors.length === 0, errors);
} finally {
  await writeFile(
    ".local/motion-qa/navigation-report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
assert.ok(
  checks.every((c) => c.pass),
  "Navigation checks failed",
);
