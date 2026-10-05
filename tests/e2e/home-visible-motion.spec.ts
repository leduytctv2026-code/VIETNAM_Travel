import { test, expect, type Page } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";

const bundle = ".local/visible-motion-runtime.js";
test.beforeAll(() => {
  buildSync({
    entryPoints: ["tests/e2e/fixtures/home-motion-runtime.ts"],
    bundle: true,
    format: "iife",
    globalName: "TravelHomeMotion",
    outfile: bundle,
  });
});

async function mount(page: Page) {
  const styles = [
    "src/styles/tokens.css",
    "src/app/globals.css",
    "src/styles/public.css",
    "src/styles/home-scenes.css",
    "src/styles/home-panels.css",
    "src/styles/home-motion.css",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  await page.setContent(`<style>${styles}</style>
    <header class="header">vietnam unfolded</header>
    <main class="cinematic-home home-panels is-cinematic">
      <section class="scene hero" data-scene="hero" style="height:100svh"><h1>Việt Nam</h1></section>
      <section class="scene intro" data-scene="intro"><div class="scene-pin"><div class="scene-stage intro-stage">
        <div class="intro-atlas" aria-hidden="true"><svg class="intro-atlas-map" viewBox="0 0 260 600"><path d="M80 30 L170 60 L130 230 L200 420 L130 570 L90 560 L155 420 L95 230 Z" fill="#e7a335"/></svg></div>
        <section class="intro-strip"><span class="intro-mark">✳</span><p>Một đất nước để khám phá.<br><strong>Một di sản để thấu hiểu.</strong></p><span class="intro-description">Từ những ngọn núi phương Bắc đến dòng sông phương Nam.</span><span class="nonprofit">Tri thức mở. Hoàn toàn phi thương mại.</span></section>
        <section class="section-wrap country-overview"><div><div class="eyebrow">VIỆT NAM, TỪNG LỚP KHÁM PHÁ</div><h2><span class="country-headline-line">Những miền đất.</span><br><em class="country-headline-line">Những điều ở lại.</em></h2></div><div><p>Địa lý mở ra cảnh quan. Lịch sử lưu giữ ký ức.</p><div class="stats-strip"><span><strong>63</strong>tỉnh thành</span><span><strong>3</strong>vùng miền</span></div></div></section>
      </div></div></section>
      <section class="scene regions" data-scene="regions"><div class="scene-pin"><div class="scene-stage regions-stage"><div class="region-heading"><div class="eyebrow">BA MIỀN. MỘT VIỆT NAM.</div><h2 class="stage-title">Những sắc thái <em>của một quê hương.</em></h2></div><div class="region-scene-viewport"><div class="region-panels">${["Miền Bắc", "Miền Trung", "Miền Nam"].map((name) => `<div class="region-slide"><a class="region-panel" href="#"><span class="region-panel-copy"><strong>${name}</strong></span></a></div>`).join("")}</div></div></div></div></section>
      <section class="scene outro discovery" data-scene="discovery"><div class="scene-stage outro-stage"><section class="section-wrap random-discovery"><svg width="40" height="40"><circle cx="20" cy="20" r="18" fill="none" stroke="white"/></svg><div><div class="eyebrow">ĐÔI KHI, KHÔNG CẦN MỘT KẾ HOẠCH</div><h2>Đưa tôi đến <em>một nơi.</em></h2><p>Một gợi ý bất ngờ để bắt đầu câu chuyện tiếp theo.</p></div><button class="green-button">Khám phá ngẫu nhiên ↗</button></section></div></section>
    </main>
    <footer class="site-footer home-panel-footer"><div class="footer-top"><div class="footer-intro">vietnam unfolded.</div>${["Khám phá", "Kết nối", "Ngôn ngữ"].map((name) => `<div class="footer-column">${name}</div>`).join("")}</div><div class="footer-wordmark">VIETNAM UNFOLDED</div><div class="footer-bottom">Lưu giữ ký ức, kết nối thế hệ.</div></footer>`);
  await page.addScriptTag({ path: bundle });
  await page.evaluate("window.TravelHomeMotion.mount()");
}

async function wheelFrames(
  page: Page,
  scene: string,
  selector: string,
  deltaY: number,
) {
  return page.evaluate(
    async ({ scene, selector, deltaY }) => {
      const panel = document.querySelector<HTMLElement>(
        `[data-scene="${scene}"]`,
      )!;
      const element = panel.querySelector<HTMLElement>(selector)!;
      const destination =
        panel.getBoundingClientRect().top +
        scrollY -
        document.querySelector<HTMLElement>(".header")!.offsetHeight;
      const started = performance.now();
      const frames: {
        ms: number;
        y: number;
        opacity: number;
        x: number;
        state?: string;
      }[] = [];
      document
        .querySelector(".header")!
        .dispatchEvent(
          new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }),
        );
      while (performance.now() - started < 2000) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const style = getComputedStyle(element);
        frames.push({
          ms: performance.now() - started,
          y: scrollY,
          opacity: Number(style.opacity),
          x: new DOMMatrixReadOnly(style.transform).m41,
          state: element.dataset.reveal,
        });
        if (
          element.dataset.reveal === "revealed" &&
          Math.abs(scrollY - destination) < 2
        )
          break;
      }
      return { destination, frames };
    },
    { scene, selector, deltaY },
  );
}

for (const width of [1440, 1366, 1280, 1024, 768, 430, 390, 375]) {
  test(`motion is visibly starting AFTER the next panel lands (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width >= 1024 ? 686 : 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mount(page);
    const result = await wheelFrames(page, "intro", ".intro-strip > p", 100);
    const landing = result.frames.find(
      (frame) => Math.abs(frame.y - result.destination) < 2,
    )!;
    expect(landing.opacity).toBeLessThan(0.4);
    expect(landing.x).toBeLessThan(width >= 768 ? -30 : -15);
    expect(
      result.frames.some(
        (frame) =>
          frame.y > 5 && frame.y < result.destination - 5 && frame.opacity > 0,
      ),
    ).toBe(false);
    expect(result.frames.at(-1)!.ms - landing.ms).toBeGreaterThan(650);
    expect(result.frames.at(-1)!.state).toBe("revealed");
    const movingFrames = result.frames.filter(
      (frame) => frame.opacity > 0.05 && frame.opacity < 0.95,
    );
    expect(movingFrames.length).toBeGreaterThan(1);
    expect(movingFrames.at(-1)!.x).toBeGreaterThan(movingFrames[0].x + 10);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({ path: `.local/visible-motion-${width}-intro.png` });
    await page.mouse.move(100, 30);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
    await page.mouse.wheel(0, 100);
    await expect(page.locator(".intro-strip > p")).toHaveAttribute(
      "data-reveal-count",
      "1",
    );
  });
}

test("an unseen section entered upwards also waits for landing, with once-only stagger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 686 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mount(page);
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "instant",
    }),
  );
  await expect(page.locator(".footer-bottom")).toHaveAttribute(
    "data-reveal",
    "revealed",
  );
  const result = await wheelFrames(
    page,
    "discovery",
    ".random-discovery h2",
    -100,
  );
  const landing = result.frames.find(
    (frame) => Math.abs(frame.y - result.destination) < 2,
  )!;
  expect(landing.opacity).toBeLessThan(0.4);
  expect(result.frames.at(-1)!.ms - landing.ms).toBeGreaterThan(750);
  await expect(page.locator(".random-discovery h2")).toHaveAttribute(
    "data-reveal-count",
    "1",
  );
  await page.screenshot({ path: ".local/visible-motion-discovery.png" });
});

test("system reduced motion still disables displacement and immediately displays content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page);
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
  const result = await wheelFrames(page, "intro", ".intro-strip > p", 100);
  expect(result.frames.at(-1)!.x).toBe(0);
  expect(result.frames.at(-1)!.opacity).toBe(1);
});

test("enabling reduced motion during a panel move instantly settles and exposes content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 686 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mount(page);
  const destination = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-scene="intro"]')!;
    return (
      panel.getBoundingClientRect().top +
      scrollY -
      document.querySelector<HTMLElement>(".header")!.offsetHeight
    );
  });
  await page.mouse.move(100, 30);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(5);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      (destination) => Math.abs(scrollY - destination),
      destination,
    ),
  ).toBeLessThan(2);
  await expect(
    page.locator('[data-reveal="pending"], [data-reveal="revealing"]'),
  ).toHaveCount(0);
});
