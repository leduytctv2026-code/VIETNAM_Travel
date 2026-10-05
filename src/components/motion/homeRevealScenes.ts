import type { RevealGroup } from "./ScrollScene";

/** Declarative editorial choreography, separate from scrolling and layout. */
export const homeRevealScenes: readonly {
  selector: string;
  watchChildren?: boolean;
  groups: readonly RevealGroup[];
}[] = [
  {
    selector: '[data-scene="intro"]',
    groups: [
      { selector: ".intro-strip > p", direction: "left" },
      { selector: ".nonprofit", direction: "up", distance: 30, delay: 0.12 },
      {
        selector: ".intro-atlas-map",
        direction: "up",
        distance: 60,
        scale: 0.95,
        delay: 0.1,
        duration: 0.9,
      },
      { selector: ".intro-description", direction: "right", delay: 0.08 },
      { selector: ".country-overview .eyebrow", direction: "up", distance: 30 },
      { selector: ".country-headline-line", direction: "left", stagger: 0.08 },
      {
        selector: ".country-overview > div:last-child > p",
        direction: "right",
        delay: 0.12,
      },
      {
        selector: ".stats-strip > span:first-child",
        direction: "up",
        distance: 30,
        scale: 0.92,
        delay: 0.18,
      },
      {
        selector: ".stats-strip > span:not(:first-child)",
        direction: "right",
        delay: 0.22,
        stagger: 0.08,
      },
    ],
  },
  {
    selector: '[data-scene="regions"]',
    groups: [
      { selector: ".eyebrow", direction: "up", distance: 30 },
      { selector: ".stage-title", direction: "left", delay: 0.08 },
      {
        selector: ".region-slide",
        direction: "up",
        distance: 80,
        scale: 0.97,
        stagger: 0.12,
      },
    ],
  },
  {
    selector: '[data-scene="gallery"]',
    groups: [
      { selector: ".eyebrow", direction: "up", distance: 30 },
      { selector: ".gallery-heading h2", direction: "left", delay: 0.08 },
      { selector: ".text-link", direction: "right", delay: 0.16 },
      {
        selector: ".gallery-layer",
        direction: "up",
        distance: 70,
        scale: 0.97,
        stagger: 0.12,
      },
    ],
  },
  {
    selector: '[data-scene="map"]',
    groups: [
      { selector: ".eyebrow", direction: "up", distance: 30 },
      { selector: ".map-intro-copy h2", direction: "left", delay: 0.08 },
      {
        selector: ".map-intro-copy p",
        direction: "up",
        distance: 40,
        delay: 0.16,
      },
      { selector: ".map-stat", direction: "right", stagger: 0.08 },
      { selector: ".map-atlas-link", direction: "right", delay: 0.2 },
      {
        selector: ".map-frame",
        direction: "up",
        distance: 50,
        scale: 0.96,
        delay: 0.12,
        duration: 0.9,
      },
    ],
  },
  {
    selector: '[data-scene="memories"]',
    groups: [
      { selector: ".history-visual", direction: "left", duration: 0.9 },
      {
        selector: ".history-copy > .eyebrow, .memory-title-mask",
        direction: "right",
        stagger: 0.08,
      },
      {
        selector: ".history-copy > p",
        direction: "up",
        distance: 40,
        delay: 0.16,
      },
      {
        selector: ".history-milestone",
        direction: "up",
        distance: 50,
        stagger: 0.08,
      },
      {
        selector: ".history-copy > .hero-secondary-action",
        direction: "up",
        distance: 30,
        delay: 0.12,
      },
    ],
  },
  {
    selector: '[data-scene="culture"]',
    groups: [
      { selector: ".section-heading .eyebrow", direction: "up", distance: 30 },
      { selector: ".section-heading h2", direction: "left", delay: 0.08 },
      {
        selector: ".section-heading .text-link",
        direction: "right",
        delay: 0.16,
      },
      { selector: ".food-media", direction: "left", duration: 0.9 },
      { selector: ".food-copy > *", direction: "right", stagger: 0.08 },
      {
        selector: ".culture-deck-card:not(:first-child)",
        direction: "up",
        distance: 70,
        scale: 0.97,
        stagger: 0.12,
      },
    ],
  },
  {
    selector: '[data-scene="facts"]',
    groups: [
      { selector: ".eyebrow", direction: "up", distance: 30 },
      { selector: ".fact-section h3", direction: "left", delay: 0.08 },
      {
        selector: ".fact-section p, .fact-section a",
        direction: "up",
        distance: 40,
        delay: 0.16,
      },
    ],
  },
  {
    selector: '[data-scene="community"]',
    watchChildren: true,
    groups: [
      { selector: ".section-heading .eyebrow", direction: "up", distance: 30 },
      { selector: ".section-heading h2", direction: "left", delay: 0.08 },
      {
        selector: ".section-heading .text-link",
        direction: "right",
        delay: 0.12,
      },
      { selector: ".gallery-actions > p", direction: "up", distance: 30 },
      { selector: ".gallery-actions > button", direction: "right", delay: 0.2 },
      {
        selector: ".gallery-empty, .masonry-gallery > .community-image",
        direction: "up",
        distance: 70,
        scale: 0.97,
        stagger: 0.12,
      },
    ],
  },
  {
    selector: '[data-scene="discovery"]',
    groups: [
      {
        selector: ".random-discovery",
        direction: "scale",
        scale: 0.985,
        duration: 0.9,
      },
      {
        selector: ".random-discovery > svg",
        direction: "fade",
        rotate: -8,
        delay: 0.08,
      },
      {
        selector: ".random-discovery .eyebrow",
        direction: "up",
        distance: 30,
        delay: 0.1,
      },
      { selector: ".random-discovery h2", direction: "left", delay: 0.16 },
      {
        selector: ".random-discovery > div:not(.random-background) > p",
        direction: "left",
        delay: 0.24,
      },
      {
        selector: ".random-discovery > button",
        direction: "right",
        delay: 0.2,
      },
    ],
  },
];

export const footerRevealGroups: readonly RevealGroup[] = [
  { selector: ".footer-intro", direction: "left" },
  {
    selector: ".footer-column",
    direction: "up",
    distance: 50,
    delay: 0.08,
    stagger: 0.1,
  },
  {
    selector: ".footer-wordmark",
    direction: "up",
    distance: 50,
    delay: 0.32,
    duration: 0.9,
  },
  { selector: ".footer-bottom", direction: "fade", delay: 0.44, duration: 0.7 },
];
