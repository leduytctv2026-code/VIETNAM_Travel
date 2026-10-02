import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_CHECK_URL || "http://localhost:3000";
const outputDirectory = "visual-check";
const screenshots = {
  homeDesktop: path.join(outputDirectory, "home-desktop.png"),
  heroLoaded: path.join(outputDirectory, "hero-loaded.png"),
  heroHover: path.join(outputDirectory, "hero-hover.png"),
  heroClicked: path.join(outputDirectory, "hero-clicked.png"),
  heroScrolled: path.join(outputDirectory, "hero-scrolled.png"),
  homeMobile: path.join(outputDirectory, "home-mobile.png"),
  provinceCarouselInitial: path.join(
    outputDirectory,
    "province-carousel-initial.png",
  ),
  provinceCarouselNext: path.join(
    outputDirectory,
    "province-carousel-next.png",
  ),
  provinceCarouselPrevious: path.join(
    outputDirectory,
    "province-carousel-previous.png",
  ),
};

await mkdir(outputDirectory, { recursive: true });

const checks = new Map();
const consoleErrors = [];
const pageErrors = [];
const failedResources = [];
const httpErrors = [];
const details = {};
let homepageLoaded = false;
let heroFound = false;
let mobileOverflow = true;
let fatalError;
let chromiumReady = false;

function check(name, pass, detail) {
  checks.set(name, Boolean(pass));
  if (detail !== undefined) details[name] = detail;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`, detail ?? "");
  return Boolean(pass);
}

function recordBrowserEvents(page, scope) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      const source = location.url
        ? ` (${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0})`
        : "";
      consoleErrors.push(`[${scope}] ${message.text()}${source}`);
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(`[${scope}] ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    if (
      ["document", "stylesheet", "script", "font", "image"].includes(
        request.resourceType(),
      )
    ) {
      failedResources.push(
        `[${scope}] ${request.resourceType()} ${request.url()} - ${request.failure()?.errorText || "unknown error"}`,
      );
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      httpErrors.push(
        `[${scope}] HTTP ${response.status()} ${response.request().resourceType()} ${response.url()}`,
      );
    }
  });
}

async function waitForVisualReady(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page
    .waitForFunction(
      () => {
        const image = document.querySelector(
          ".slider-layer[aria-hidden='false'] img",
        );
        return image instanceof HTMLImageElement && image.complete;
      },
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
}

async function visualState(page, selector) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        opacity: style.opacity,
        transform: style.transform,
        filter: style.filter,
        clipPath: style.clipPath,
        visibility: style.visibility,
        left: Math.round(rect.left * 100) / 100,
        top: Math.round(rect.top * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      };
    });
}

function stateChanged(before, after, keys) {
  return keys.some((key) => before?.[key] !== after?.[key]);
}

function isExpectedGuestAuth401(error) {
  return /HTTP 401 .*\/api\/v1\/auth\/(?:user\/)?me(?:\?|$)/.test(error);
}

async function heroState(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".hero-card")];
    const activeIndex = cards.findIndex(
      (card) => card.getAttribute("aria-pressed") === "true",
    );
    const layers = [...document.querySelectorAll(".slider-layer")];
    const activeLayerIndex = layers.findIndex(
      (layer) => layer.getAttribute("aria-hidden") === "false",
    );
    const activeImage = layers[activeLayerIndex]?.querySelector("img");
    return {
      title:
        document.querySelector(".hero-title")?.getAttribute("aria-label") || "",
      activeIndex,
      activeLayerIndex,
      background:
        activeImage instanceof HTMLImageElement
          ? activeImage.currentSrc || activeImage.src
          : "",
    };
  });
}

async function openingState(page) {
  return {
    background: await visualState(page, ".hero-load-image"),
    title: await visualState(page, ".hero-opening-line"),
    card: await visualState(page, ".hero-card-carousel"),
  };
}

function printReport() {
  const status = (name) => (checks.get(name) ? "PASS" : "FAIL");
  const errorDetails = [...consoleErrors, ...pageErrors];
  const expectedGuestAuthErrors = httpErrors.filter(
    isExpectedGuestAuth401,
  ).length;
  console.log("\nBROWSER VALIDATION");
  console.log("------------------\n");
  console.log("Playwright: ALREADY INSTALLED");
  console.log(`Chromium: ${chromiumReady ? "READY" : "FAILED"}`);
  console.log(
    `Dev server: ${homepageLoaded ? `RUNNING at ${baseUrl}` : "FAILED"}`,
  );
  console.log(`Homepage: ${homepageLoaded ? "LOADED" : "FAILED"}`);
  console.log(`Hero selector: ${heroFound ? "FOUND" : "NOT FOUND"}`);
  console.log(
    `Console errors: ${errorDetails.length}${expectedGuestAuthErrors ? ` (expected guest auth 401: ${expectedGuestAuthErrors})` : ""}`,
  );
  for (const error of errorDetails) console.log(`- ${error}`);
  console.log(`Opening animation: ${status("Opening animation")}`);
  console.log(`Province carousel: ${status("Province carousel")}`);
  console.log(`Carousel directions: ${status("Carousel directions")}`);
  console.log(`Carousel range: ${status("Carousel range")}`);
  console.log(`Card hover: ${status("Card hover")}`);
  console.log(`Card click: ${status("Card click")}`);
  console.log(`Background transition: ${status("Background transition")}`);
  console.log(`Autoplay: ${status("Autoplay")}`);
  console.log(`Mouse parallax: ${status("Mouse parallax")}`);
  console.log(`Scroll animation: ${status("Scroll animation")}`);
  console.log(`Desktop layout: ${status("Desktop layout")}`);
  console.log(`Mobile layout: ${status("Mobile layout")}`);
  console.log(`Horizontal overflow: ${mobileOverflow ? "YES" : "NO"}`);
  console.log(`Failed important resources: ${failedResources.length}`);
  for (const error of failedResources) console.log(`- ${error}`);
  console.log(`HTTP errors: ${httpErrors.length}`);
  for (const error of httpErrors) console.log(`- ${error}`);
  console.log("Screenshots:");
  for (const screenshot of Object.values(screenshots)) {
    console.log(`- ${path.resolve(screenshot)}`);
  }
  if (fatalError) console.log(`Fatal error: ${fatalError.stack || fatalError}`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  chromiumReady = true;
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  const page = await desktop.newPage();
  recordBrowserEvents(page, "desktop");

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  homepageLoaded = Boolean(response?.ok());
  assert(
    homepageLoaded,
    `Homepage returned HTTP ${response?.status() ?? "unknown"}`,
  );

  const hero = page.locator(".hero.heritage-hero");
  await hero.waitFor({ state: "attached", timeout: 15_000 });
  heroFound = (await hero.count()) === 1;
  assert(heroFound, "Expected exactly one .hero.heritage-hero");

  const openingSamples = [];
  openingSamples.push({ at: 0, ...(await openingState(page)) });
  for (const [delay, at] of [
    [300, 300],
    [400, 700],
    [500, 1200],
    [800, 2000],
  ]) {
    await page.waitForTimeout(delay);
    openingSamples.push({ at, ...(await openingState(page)) });
  }
  details.openingSamples = openingSamples;
  const openingFirst = openingSamples[0];
  const openingLast = openingSamples.at(-1);
  const backgroundOpened = stateChanged(
    openingFirst.background,
    openingLast.background,
    ["transform", "filter", "clipPath"],
  );
  const titleOpened = stateChanged(openingFirst.title, openingLast.title, [
    "transform",
    "top",
  ]);
  const cardsOpened = stateChanged(openingFirst.card, openingLast.card, [
    "opacity",
    "transform",
    "top",
  ]);
  check(
    "Opening animation",
    backgroundOpened && titleOpened && cardsOpened,
    { backgroundOpened, titleOpened, cardsOpened },
  );

  await waitForVisualReady(page);
  await page.screenshot({ path: screenshots.homeDesktop });
  await hero.screenshot({ path: screenshots.heroLoaded });

  const cards = page.locator(".hero-card");
  const cardCount = await cards.count();
  const carouselLayout = await page.evaluate(() => {
    const viewport = document.querySelector(".hero-card-carousel");
    const track = document.querySelector(".hero-card-deck");
    const activeCard = document.querySelector(
      '.hero-card[aria-pressed="true"]',
    );
    const viewportRect = viewport?.getBoundingClientRect();
    const trackRect = track?.getBoundingClientRect();
    const activeRect = activeCard?.getBoundingClientRect();
    const activeCenter = activeRect ? activeRect.left + activeRect.width / 2 : 0;
    const focalCenter = viewportRect
      ? viewportRect.left + viewportRect.width * 0.4
      : 0;
    return {
      viewportWidth: viewportRect?.width || 0,
      trackWidth: trackRect?.width || 0,
      activeCenter,
      focalCenter,
      focalDelta: Math.abs(activeCenter - focalCenter),
    };
  });
  check(
    "Province carousel",
    cardCount === 63 &&
      carouselLayout.trackWidth > carouselLayout.viewportWidth &&
      carouselLayout.focalDelta < 5,
    { cardCount, carouselLayout },
  );

  const desktopLayout = await page.evaluate(() => {
    const hero = document.querySelector(".hero.heritage-hero");
    const title = document.querySelector(".hero-title");
    const heroRect = hero?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    return {
      heroVisible: Boolean(
        heroRect && heroRect.width > 1000 && heroRect.height > 700,
      ),
      titleInside:
        Boolean(titleRect) &&
        titleRect.left >= -1 &&
        titleRect.right <= innerWidth + 1,
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    };
  });
  check(
    "Desktop layout",
    desktopLayout.heroVisible &&
      desktopLayout.titleInside &&
      !desktopLayout.overflow,
    desktopLayout,
  );

  const initialHeroState = await heroState(page);
  const initialTrack = await visualState(page, ".hero-card-deck");
  await hero.screenshot({ path: screenshots.provinceCarouselInitial });

  await cards.nth(initialHeroState.activeIndex + 1).click();
  await page.waitForFunction(
    (previous) =>
      [...document.querySelectorAll(".hero-card")].findIndex(
        (card) => card.getAttribute("aria-pressed") === "true",
      ) === previous + 1,
    initialHeroState.activeIndex,
    { timeout: 3_000 },
  );
  await page.waitForTimeout(1_050);
  const nextTrack = await visualState(page, ".hero-card-deck");
  await hero.screenshot({ path: screenshots.provinceCarouselNext });

  await cards.nth(initialHeroState.activeIndex).click();
  await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll(".hero-card")].findIndex(
        (card) => card.getAttribute("aria-pressed") === "true",
      ) === expected,
    initialHeroState.activeIndex,
    { timeout: 3_000 },
  );
  await page.waitForTimeout(1_050);
  const previousTrack = await visualState(page, ".hero-card-deck");
  await hero.screenshot({ path: screenshots.provinceCarouselPrevious });
  check(
    "Carousel directions",
    nextTrack.left < initialTrack.left &&
      Math.abs(previousTrack.left - initialTrack.left) < 2,
    { initialTrack, nextTrack, previousTrack },
  );

  const hoverIndex = (initialHeroState.activeIndex + 1) % cardCount;
  const hoverCard = cards.nth(hoverIndex);
  const beforeHover = await visualState(
    page,
    `.hero-card:nth-child(${hoverIndex + 1}) .hero-card-inner`,
  );
  await hoverCard.hover();
  await page.waitForTimeout(500);
  const afterHover = await visualState(
    page,
    `.hero-card:nth-child(${hoverIndex + 1}) .hero-card-inner`,
  );
  check(
    "Card hover",
    stateChanged(beforeHover, afterHover, [
      "transform",
      "top",
      "width",
      "height",
    ]),
    { beforeHover, afterHover },
  );
  await hero.screenshot({ path: screenshots.heroHover });

  await hoverCard.click();
  await page.waitForFunction(
    (index) =>
      document
        .querySelectorAll(".hero-card")
        .item(index)
        ?.getAttribute("aria-pressed") === "true",
    hoverIndex,
    { timeout: 3_000 },
  );
  await page.waitForTimeout(220);
  const transitionState = await visualState(
    page,
    ".hero-background-incoming img",
  );
  await page.waitForTimeout(1_250);
  const afterClick = await heroState(page);
  const settledBackground = await visualState(
    page,
    ".hero-background-incoming img",
  );
  const clickChanged =
    afterClick.activeIndex !== initialHeroState.activeIndex ||
    afterClick.title !== initialHeroState.title ||
    afterClick.background !== initialHeroState.background;
  check("Card click", clickChanged, {
    before: initialHeroState,
    after: afterClick,
  });
  check(
    "Background transition",
    stateChanged(transitionState, settledBackground, [
      "transform",
      "opacity",
    ]),
    { transitionState, settledBackground },
  );
  await hero.screenshot({ path: screenshots.heroClicked });

  await page.mouse.move(20, 120);
  const autoplayBefore = await heroState(page);
  await page.waitForFunction(
    (previous) => {
      const cards = [...document.querySelectorAll(".hero-card")];
      return (
        cards.findIndex(
          (card) => card.getAttribute("aria-pressed") === "true",
        ) !== previous
      );
    },
    autoplayBefore.activeIndex,
    { timeout: 11_000 },
  );
  const autoplayAfter = await heroState(page);
  await page.waitForTimeout(1_300);
  const autoplayStable = await heroState(page);
  check(
    "Autoplay",
    autoplayAfter.activeIndex !== autoplayBefore.activeIndex &&
      autoplayStable.activeIndex === autoplayAfter.activeIndex,
    { before: autoplayBefore, after: autoplayAfter, stable: autoplayStable },
  );

  const rangeIndexes = [0, Math.floor(cardCount / 2), cardCount - 1];
  const rangeStates = [];
  for (const rangeIndex of rangeIndexes) {
    await cards.nth(rangeIndex).evaluate((card) => {
      if (card instanceof HTMLButtonElement) card.click();
    });
    await page.waitForFunction(
      (expected) =>
        [...document.querySelectorAll(".hero-card")].findIndex(
          (card) => card.getAttribute("aria-pressed") === "true",
        ) === expected,
      rangeIndex,
      { timeout: 3_000 },
    );
    await page.waitForTimeout(1_050);
    rangeStates.push({
      index: rangeIndex,
      track: await visualState(page, ".hero-card-deck"),
      state: await heroState(page),
    });
  }
  check(
    "Carousel range",
    rangeStates.every(({ index, state }) => state.activeIndex === index) &&
      rangeStates[0].track.left > rangeStates[1].track.left &&
      rangeStates[1].track.left > rangeStates[2].track.left,
    { rangeStates },
  );

  const heroBox = await hero.boundingBox();
  assert(heroBox, "Hero has no bounding box");
  const parallaxSelectors = [
    ".hero-background-parallax",
    ".hero-copy-parallax",
    ".hero-card-deck-parallax",
  ];
  const parallaxSnapshot = async () =>
    Promise.all(
      parallaxSelectors.map((selector) => visualState(page, selector)),
    );
  await page.mouse.move(
    heroBox.x + heroBox.width / 2,
    heroBox.y + heroBox.height / 2,
  );
  await page.waitForTimeout(900);
  const parallaxCenter = await parallaxSnapshot();
  await page.mouse.move(heroBox.x + 30, heroBox.y + 100);
  await page.waitForTimeout(900);
  const parallaxTopLeft = await parallaxSnapshot();
  await page.mouse.move(
    heroBox.x + heroBox.width - 30,
    heroBox.y + heroBox.height - 100,
  );
  await page.waitForTimeout(900);
  const parallaxBottomRight = await parallaxSnapshot();
  const parallaxLayersChanged = parallaxSelectors.map(
    (_, index) =>
      parallaxTopLeft[index].transform !== parallaxBottomRight[index].transform,
  );
  check("Mouse parallax", parallaxLayersChanged.every(Boolean), {
    parallaxCenter,
    parallaxTopLeft,
    parallaxBottomRight,
  });

  const scrollBefore = {
    hero: await visualState(page, ".hero.heritage-hero"),
    camera: await visualState(page, ".hero-camera"),
    content: await visualState(page, ".hero-content-scroll"),
  };
  const heroRange = await page.evaluate(() => {
    const scene = document.querySelector('[data-scene="hero"]');
    return {
      start: Number(scene?.getAttribute("data-scroll-start")),
      end: Number(scene?.getAttribute("data-scroll-end")),
    };
  });
  assert(
    Number.isFinite(heroRange.start) &&
      Number.isFinite(heroRange.end) &&
      heroRange.end > heroRange.start,
    "Hero ScrollTrigger range was not initialized",
  );
  const scrollTarget =
    heroRange.start + (heroRange.end - heroRange.start) * 0.45;
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    scrollTarget,
  );
  await page.waitForTimeout(1_100);
  const scrollAfter = {
    hero: await visualState(page, ".hero.heritage-hero"),
    camera: await visualState(page, ".hero-camera"),
    content: await visualState(page, ".hero-content-scroll"),
  };
  const scrollLayersChanged =
    stateChanged(scrollBefore.camera, scrollAfter.camera, ["transform"]) &&
    stateChanged(scrollBefore.content, scrollAfter.content, [
      "transform",
      "opacity",
    ]);
  const heroRootStayedStable =
    scrollBefore.hero.transform === scrollAfter.hero.transform;
  check("Scroll animation", scrollLayersChanged && heroRootStayedStable, {
    heroRange,
    scrollTarget,
    before: scrollBefore,
    after: scrollAfter,
  });
  await page.screenshot({ path: screenshots.heroScrolled });

  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
  });
  const mobilePage = await mobile.newPage();
  recordBrowserEvents(mobilePage, "mobile");
  const mobileResponse = await mobilePage.goto(baseUrl, {
    waitUntil: "domcontentloaded",
  });
  assert(
    mobileResponse?.ok(),
    `Mobile homepage returned HTTP ${mobileResponse?.status()}`,
  );
  await mobilePage.locator(".hero.heritage-hero").waitFor({ state: "visible" });
  await waitForVisualReady(mobilePage);
  await mobilePage.waitForTimeout(2_000);
  const mobileLayout = await mobilePage.evaluate(() => {
    const title = document
      .querySelector(".hero-title")
      ?.getBoundingClientRect();
    const activeCard = document
      .querySelector('.hero-card[aria-pressed="true"]')
      ?.getBoundingClientRect();
    const menu = document
      .querySelector(".mobile-menu")
      ?.getBoundingClientRect();
    const cardCount = document.querySelectorAll(".hero-card").length;
    return {
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      titleInside:
        Boolean(title) && title.left >= -1 && title.right <= innerWidth + 1,
      cardCount,
      activeCardVisible:
        Boolean(activeCard) &&
        activeCard.width >= 140 &&
        activeCard.width <= 170 &&
        activeCard.height > 120 &&
        activeCard.right > 0 &&
        activeCard.left < innerWidth,
      menuVisible:
        Boolean(menu) && menu.width > 20 && menu.height > 20 && menu.top >= 0,
    };
  });
  mobileOverflow = mobileLayout.overflow;
  const mobileMenu = mobilePage.locator(".mobile-menu");
  await mobileMenu.click();
  const navigationUsable = await mobilePage.locator("nav.nav.open").isVisible();
  await mobileMenu.click();
  check(
    "Mobile layout",
    !mobileLayout.overflow &&
      mobileLayout.titleInside &&
      mobileLayout.cardCount === 63 &&
      mobileLayout.activeCardVisible &&
      mobileLayout.menuVisible &&
      navigationUsable,
    { ...mobileLayout, navigationUsable },
  );
  await mobilePage.screenshot({ path: screenshots.homeMobile });
  await mobile.close();
} catch (error) {
  fatalError = error;
  console.error(error);
} finally {
  await browser?.close();
  printReport();
}

const expectedAuth401 = httpErrors.some(isExpectedGuestAuth401);
const unexpectedConsoleErrors = consoleErrors.filter(
  (error) =>
    !(
      expectedAuth401 &&
      /Failed to load resource: the server responded with a status of 401/.test(
        error,
      )
    ),
);
const unexpectedHttpErrors = httpErrors.filter(
  (error) => !isExpectedGuestAuth401(error),
);

if (
  fatalError ||
  [...checks.values()].some((passed) => !passed) ||
  unexpectedConsoleErrors.length > 0 ||
  pageErrors.length > 0 ||
  failedResources.length > 0 ||
  unexpectedHttpErrors.length > 0
) {
  process.exitCode = 1;
}
