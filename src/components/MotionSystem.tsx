"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

const revealHeadingSelector = [
  ".section-heading h2",
  ".country-overview h2",
  ".fact-section h3",
  ".detail-section > h2",
  ".editorial-section h2",
  ".history-layout h2",
  ".province-panel > h2",
  ".province-hero-copy h1",
].join(",");

const imageRevealSelector = [
  ".featured-destination",
  ".card-image",
  ".food-feature > :first-child",
  ".official-gallery > *",
].join(",");

export function MotionSystem() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    gsap.registerPlugin(ScrollTrigger);
    const main = document.querySelector("main");
    const media = gsap.matchMedia();
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (disposed) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!disposed) ScrollTrigger.refresh();
      }, 100);
    };

    // GSAP owns the only animation clock. Touch devices keep native scrolling.
    // matchMedia also destroys smoothing immediately when the preference changes.
    media.add(
      "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        const root = document.documentElement;
        const originalScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        const lenis = new Lenis({
          autoRaf: false,
          lerp: 0.1,
          smoothWheel: true,
          syncTouch: false,
          anchors: { offset: -96 },
          prevent: (node) =>
            node.matches(
              ".leaflet-container, dialog, [role='dialog'], textarea, select, [data-lenis-prevent]",
            ),
        });
        const update = () => ScrollTrigger.update();
        const tick = (time: number) => lenis.raf(time * 1000);
        // Never refresh ScrollTrigger from its own refresh event: that recurses.
        const resizeLenis = () => lenis.resize();
        const syncScrollLock = () => {
          const locked =
            document.body.style.overflow === "hidden" ||
            document.querySelector("dialog[open]") !== null;
          if (locked) lenis.stop();
          else lenis.start();
        };
        const bodyObserver = new MutationObserver(syncScrollLock);
        bodyObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ["style"],
        });
        document.addEventListener("toggle", syncScrollLock, true);
        syncScrollLock();
        lenis.on("scroll", update);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.addEventListener("refresh", resizeLenis);
        scheduleRefresh();

        return () => {
          bodyObserver.disconnect();
          document.removeEventListener("toggle", syncScrollLock, true);
          ScrollTrigger.removeEventListener("refresh", resizeLenis);
          gsap.ticker.remove(tick);
          lenis.off("scroll", update);
          lenis.destroy();
          root.style.scrollBehavior = originalScrollBehavior;
        };
      },
    );

    // Homepage scenes own every homepage transform. These modest reveals belong
    // only to detail pages and are reverted on navigation or live motion changes.
    if (main && pathname !== "/") {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        main
          .querySelectorAll<HTMLElement>(revealHeadingSelector)
          .forEach((heading) => {
            if (heading.closest(".heritage-hero")) return;
            gsap.fromTo(
              heading,
              { autoAlpha: 0, y: 48, clipPath: "inset(0 0 100% 0)" },
              {
                autoAlpha: 1,
                y: 0,
                clipPath: "inset(0 0 0% 0)",
                duration: 0.9,
                ease: "power4.out",
                clearProps: "transform,opacity,visibility,clipPath",
                scrollTrigger: {
                  trigger: heading,
                  start: "top 90%",
                  once: true,
                },
              },
            );
          });

        main
          .querySelectorAll<HTMLElement>(imageRevealSelector)
          .forEach((frame) => {
            const image = frame.querySelector("img");
            if (!image) return;
            const timeline = gsap.timeline({
              scrollTrigger: { trigger: frame, start: "top 90%", once: true },
            });
            timeline
              .fromTo(
                frame,
                { clipPath: "inset(0 0 100% 0)" },
                {
                  clipPath: "inset(0 0 0% 0)",
                  duration: 1,
                  ease: "power4.out",
                  clearProps: "clipPath",
                },
              )
              .fromTo(
                image,
                { scale: 1.08 },
                {
                  scale: 1,
                  duration: 1,
                  ease: "power3.out",
                  clearProps: "transform",
                },
                0,
              );
          });
      });
    }

    // Capture image load events, including lazy images that finish after load.
    // A short debounce batches simultaneous images instead of refreshing per image.
    if (pathname !== "/") {
      main?.addEventListener("load", scheduleRefresh, true);
      window.addEventListener("load", scheduleRefresh, { once: true });
      void document.fonts.ready.then(scheduleRefresh);
    }
    scheduleRefresh();

    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      main?.removeEventListener("load", scheduleRefresh, true);
      window.removeEventListener("load", scheduleRefresh);
      media.revert();
    };
  }, [pathname]);

  return null;
}

export default MotionSystem;
