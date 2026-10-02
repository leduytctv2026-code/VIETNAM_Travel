"use client";

import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The page content stays in normal document flow. Only the existing Hero
 * camera responds to scroll; no content section is pinned or assigned an
 * artificial multi-viewport height.
 */
export function useHomeCinematicScenes(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const main = root.current;
    if (!main) return;

    gsap.registerPlugin(ScrollTrigger);
    main.classList.add("is-cinematic");
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add(
        "(min-width: 1024px) and (min-height: 640px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
        () => {
          const chapter = main.querySelector<HTMLElement>(
            '[data-scene="hero"]',
          );
          const camera = main.querySelector<HTMLElement>(".hero-camera");
          const content = main.querySelector<HTMLElement>(
            ".hero-content-scroll",
          );
          const bottom = main.querySelector<HTMLElement>(".hero-bottom-scroll");
          const shade = main.querySelector<HTMLElement>(".hero-scroll-shade");
          if (!chapter || !camera || !content || !bottom || !shade) return;

          const timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              id: "scene:hero",
              trigger: chapter,
              start: "top top",
              end: "bottom top",
              scrub: 0.65,
              invalidateOnRefresh: true,
              onRefresh: (trigger) => {
                chapter.dataset.scrollStart = String(Math.round(trigger.start));
                chapter.dataset.scrollEnd = String(Math.round(trigger.end));
              },
            },
          });

          timeline
            .to(camera, { scale: 1.12, yPercent: 4, duration: 1 }, 0)
            .to(
              content,
              { y: -100, scale: 1.05, opacity: 0, duration: 0.72 },
              0,
            )
            .to(bottom, { y: -52, opacity: 0, duration: 0.52 }, 0)
            .to(shade, { opacity: 0.28, duration: 0.9 }, 0);

          return () => {
            timeline.scrollTrigger?.kill();
            timeline.kill();
            gsap.set([camera, content, bottom, shade], {
              clearProps: "transform,opacity",
            });
            delete chapter.dataset.scrollStart;
            delete chapter.dataset.scrollEnd;
          };
        },
      );
    }, main);

    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = (event?: Event) => {
      if (
        disposed ||
        (event?.target instanceof Element &&
          event.target.closest(".map-camera"))
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!disposed) ScrollTrigger.refresh();
      }, 120);
    };

    main.addEventListener("load", refresh, true);
    void document.fonts.ready.then(() => refresh());
    refresh();

    return () => {
      disposed = true;
      clearTimeout(timer);
      main.removeEventListener("load", refresh, true);
      media.revert();
      context.revert();
      main.classList.remove("is-cinematic");
    };
  }, [root]);
}
