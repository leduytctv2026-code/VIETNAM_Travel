import { expect, test, type Page } from "@playwright/test";
import {
  footerRevealGroups,
  homeRevealScenes,
} from "../../src/components/motion/homeRevealScenes";

// These regressions intentionally use the real Next route, React hydration,
// providers, API content and installed motion runtime, not a bundled DOM fixture.
const introSelector = '[data-scene="intro"] .intro-strip > p';

async function ready(page: Page, reducedMotion: "reduce" | "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  await expect(page.locator("main.cinematic-home.is-cinematic")).toBeAttached();
  await expect(page.locator(introSelector)).toHaveAttribute(
    "data-reveal",
    reducedMotion === "reduce" ? "revealed" : "pending",
  );
  await page.evaluate(() => document.fonts.ready);
}

async function wheelIntro(page: Page) {
  await page.mouse.move(100, 40);
  const sampling = page.locator(introSelector).evaluate(async (element) => {
    const header = document.querySelector<HTMLElement>(".header")!;
    const panel = element.closest<HTMLElement>('[data-scene="intro"]')!;
    const destination =
      panel.getBoundingClientRect().top + scrollY - header.offsetHeight;
    const started = performance.now();
    const frames: {
      ms: number;
      y: number;
      x: number;
      opacity: number;
      state?: string;
      animations: number;
    }[] = [];
    while (performance.now() - started < 3500) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const style = getComputedStyle(element);
      frames.push({
        ms: performance.now() - started,
        y: scrollY,
        x: new DOMMatrixReadOnly(style.transform).m41,
        opacity: Number(style.opacity),
        state: (element as HTMLElement).dataset.reveal,
        animations: element.getAnimations().length,
      });
      if (
        (element as HTMLElement).dataset.reveal === "revealed" &&
        Math.abs(scrollY - destination) < 2
      )
        break;
    }
    return { destination, frames };
  });
  await page.mouse.wheel(0, 100);
  return sampling;
}

test.use({ viewport: { width: 1366, height: 686 } });

test("real homepage registers every reveal and visibly animates after the wheel panel lands", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "no-preference");

  const registry = await page.evaluate(
    ({ scenes, footerGroups }) => {
      const targets = new Set<Element>();
      for (const { selector, groups } of scenes) {
        const scope = document.querySelector(selector);
        if (!scope) continue;
        for (const group of groups)
          scope.querySelectorAll(group.selector).forEach((element) => {
            targets.add(element);
          });
      }
      const footer = document.querySelector(".home-panel-footer");
      for (const group of footerGroups)
        footer?.querySelectorAll(group.selector).forEach((element) => {
          targets.add(element);
        });
      return {
        count: targets.size,
        unregistered: [...targets].filter(
          (element) => !element.hasAttribute("data-reveal"),
        ).length,
        pending: document.querySelectorAll('[data-reveal="pending"]').length,
        lenis: document.documentElement.classList.contains("lenis"),
      };
    },
    { scenes: homeRevealScenes, footerGroups: footerRevealGroups },
  );
  expect(registry.count).toBeGreaterThan(40);
  expect(registry.unregistered).toBe(0);
  expect(registry.pending).toBeGreaterThan(40);
  expect(registry.lenis).toBe(false);

  const { frames, destination } = await wheelIntro(page);
  const landing = frames.find((frame) => Math.abs(frame.y - destination) < 2)!;
  expect(landing).toBeDefined();
  expect(landing.opacity).toBeLessThan(0.4);
  expect(landing.x).toBeLessThan(-30);
  expect(
    frames.some(
      (frame) => Math.abs(frame.y - destination) > 8 && frame.opacity > 0.05,
    ),
  ).toBe(false);
  expect(
    frames.some(
      (frame) =>
        frame.state === "revealing" &&
        frame.opacity > 0.15 &&
        frame.opacity < 0.95 &&
        frame.x < -2 &&
        frame.animations > 0,
    ),
  ).toBe(true);
  expect(frames.at(-1)!.ms - landing.ms).toBeGreaterThan(650);
  expect(frames.at(-1)!.state).toBe("revealed");
  // Opacity and transform have one owner each; no leftover inline GSAP writer
  // or compositor state may overwrite the completed entrance.
  expect(
    Math.max(...frames.map((frame) => frame.animations)),
  ).toBeLessThanOrEqual(2);
  expect(
    await page.locator(introSelector).evaluate((element) => {
      const style = (element as HTMLElement).style;
      return [
        style.opacity,
        style.transform,
        style.willChange,
        style.transition,
      ];
    }),
  ).toEqual(["", "", "", ""]);
  await expect(page.locator(introSelector)).toHaveAttribute(
    "data-reveal-count",
    "1",
  );
  expect(errors).toEqual([]);
});

test("real homepage honors reduced motion without leaving content hidden", async ({
  page,
}) => {
  await ready(page, "reduce");
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
  await expect(page.locator('[data-reveal="revealing"]')).toHaveCount(0);
  await expect(page.locator("[data-reveal-count]")).toHaveCount(0);
  const { frames } = await wheelIntro(page);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.every((frame) => frame.opacity === 1 && frame.x === 0)).toBe(
    true,
  );
  expect(frames.every((frame) => frame.animations === 0)).toBe(true);
});

test("once-only ownership survives reverse wheel, route cleanup and a fresh reload", async ({
  page,
}) => {
  await ready(page, "no-preference");
  await wheelIntro(page);
  const intro = page.locator(introSelector);
  await expect(intro).toHaveAttribute("data-reveal-count", "1");
  await page.mouse.wheel(0, -100);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  // Wait beyond the tween tail, then revisit the already-consumed entrance.
  await page.waitForTimeout(120);
  await wheelIntro(page);
  await expect(intro).toHaveAttribute("data-reveal-count", "1");
  expect(
    await intro.evaluate((element) => element.getAnimations().length),
  ).toBe(0);

  await intro.evaluate((element) => {
    const state = window as typeof window & { retiredIntro?: Element };
    state.retiredIntro = element;
  });
  await page.locator('.header a[href="/explore"]').click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator("main.cinematic-home")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const state = window as typeof window & { retiredIntro?: HTMLElement };
      const element = state.retiredIntro!;
      return {
        connected: element.isConnected,
        reveal: element.dataset.reveal,
        count: element.dataset.revealCount,
        transform: element.style.transform,
        opacity: element.style.opacity,
      };
    }),
  ).toEqual({
    connected: false,
    reveal: undefined,
    count: undefined,
    transform: "",
    opacity: "",
  });

  await page.locator('.header nav a[href="/"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(intro).toHaveAttribute("data-reveal", "pending");
  await expect(intro).not.toHaveAttribute("data-reveal-count", /.+/);
  await wheelIntro(page);
  await expect(intro).toHaveAttribute("data-reveal-count", "1");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.reload();
  await expect(intro).toHaveAttribute("data-reveal", "pending");
  await expect(intro).not.toHaveAttribute("data-reveal-count", /.+/);
  await wheelIntro(page);
  await expect(intro).toHaveAttribute("data-reveal-count", "1");
});

test("hero card handoff has a single owner across motion preference and viewport changes", async ({
  page,
}) => {
  await ready(page, "no-preference");
  const activeCard = page.locator('.hero-card[data-active="true"]');
  const retiredIndex = Number(
    await activeCard.getAttribute("data-province-index"),
  );
  const total = await page.locator(".hero-card").count();
  expect(total).toBeGreaterThan(1);
  const nextIndex =
    retiredIndex + 1 < total ? retiredIndex + 1 : retiredIndex - 1;
  const retired = page.locator(
    `.hero-card[data-province-index="${retiredIndex}"] .hero-card-motion`,
  );
  const next = page.locator(`.hero-card[data-province-index="${nextIndex}"]`);
  await expect(activeCard.locator(".hero-card-motion")).toHaveCSS(
    "opacity",
    "1",
  );
  await next.click();
  await expect(next).toHaveAttribute("data-active", "true");
  await expect(retired).toHaveCSS("opacity", "0.68");
  await expect(next.locator(".hero-card-motion")).toHaveCSS("opacity", "1");

  const expectOwnedCardState = async () => {
    // Let GSAP matchMedia contexts rebuild before examining their writes. A
    // second initialization writer previously overwrote the retired handoff.
    await page.waitForTimeout(250);
    const state = await page.evaluate(
      ({ retiredIndex, nextIndex }) => {
        const read = (index: number) => {
          const element = document.querySelector<HTMLElement>(
            `.hero-card[data-province-index="${index}"] .hero-card-motion`,
          )!;
          const computed = getComputedStyle(element);
          const matrix = new DOMMatrixReadOnly(computed.transform);
          return {
            opacity: Number(computed.opacity),
            scaleX: matrix.m11,
            scaleY: matrix.m22,
            inlineOpacity: element.style.opacity,
          };
        };
        return { retired: read(retiredIndex), active: read(nextIndex) };
      },
      { retiredIndex, nextIndex },
    );
    expect(state.retired.opacity).toBeCloseTo(0.68, 2);
    expect(state.retired.inlineOpacity).toBe("0.68");
    expect(state.retired.scaleX).toBeCloseTo(0.9, 2);
    expect(state.retired.scaleY).toBeCloseTo(0.9, 2);
    expect(state.active.opacity).toBe(1);
    expect(state.active.scaleX).toBeCloseTo(1, 2);
    expect(state.active.scaleY).toBeCloseTo(1, 2);
  };

  await expectOwnedCardState();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectOwnedCardState();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expectOwnedCardState();
  await page.setViewportSize({ width: 1023, height: 686 });
  await expectOwnedCardState();
  await page.setViewportSize({ width: 1366, height: 686 });
  await expectOwnedCardState();
});
