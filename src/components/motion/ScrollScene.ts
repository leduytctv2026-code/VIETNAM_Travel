"use client";

import { animateMini } from "framer-motion";
import { useLayoutEffect, type RefObject } from "react";
import { isPanelNavigating, panelSettledEvent } from "./panelNavigation";

export type RevealDirection =
  "left" | "right" | "up" | "down" | "scale" | "fade";

export interface RevealOptions {
  direction?: RevealDirection;
  distance?: number;
  scale?: number;
  rotate?: number;
  delay?: number;
  duration?: number;
}

/** A group applies stagger to existing elements, without changing their markup. */
export interface RevealGroup extends RevealOptions {
  selector: string;
  stagger?: number;
}

const ease = [0.22, 1, 0.36, 1] as const;
const ownedStyles = [
  "transform",
  "opacity",
  "will-change",
  "transition",
] as const;
type RevealElement = HTMLElement | SVGElement;

export function revealTransform(options: RevealOptions, mobile: boolean) {
  const direction = options.direction || "up";
  const horizontal = direction === "left" || direction === "right";
  const distance = Math.min(
    options.distance ?? (horizontal ? 80 : 60),
    mobile ? (horizontal ? 36 : 40) : Infinity,
  );
  const x =
    direction === "left" ? -distance : direction === "right" ? distance : 0;
  const y =
    direction === "up" ? distance : direction === "down" ? -distance : 0;
  const scale = options.scale ?? (direction === "scale" ? 0.96 : 1);
  return `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${options.rotate ?? 0}deg)`;
}

/**
 * One IntersectionObserver per scene, no scroll handler or React animation state.
 * CSS transforms/opacities are composed and restored, so hover and positioned
 * SVGs retain their original appearance. Content stays visible without JS.
 */
export function setupScrollScene(
  scope: HTMLElement,
  groups: readonly RevealGroup[],
  watchChildren = false,
) {
  if (typeof IntersectionObserver === "undefined") return () => {};

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 767px)");
  const records = new Map<
    RevealElement,
    {
      options: RevealOptions;
      original: { property: string; value: string; priority: string }[];
      transform: string;
      opacity: number;
      animation?: ReturnType<typeof animateMini>;
      state: "pending" | "revealing" | "revealed";
    }
  >();
  let disposed = false;
  let settlementFrame: number | undefined;
  const visible = new Set<RevealElement>();

  const restore = (element: RevealElement) => {
    const record = records.get(element);
    if (!record) return;
    record.original.forEach(({ property, value, priority }) => {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    });
  };

  const finish = (element: RevealElement) => {
    const record = records.get(element);
    if (!record) return;
    record.state = "revealed";
    record.animation?.stop();
    record.animation = undefined;
    restore(element);
    element.dataset.reveal = "revealed";
    observer.unobserve(element);
    visible.delete(element);
  };

  const prepare = (element: RevealElement) => {
    const record = records.get(element)!;
    element.style.transition = "none";
    element.style.opacity = "0";
    element.style.transform =
      `${record.transform} ${revealTransform(record.options, mobile.matches)}`.trim();
    element.dataset.reveal = "pending";
  };

  const revealVisible = () => {
    if (disposed || isPanelNavigating() || settlementFrame !== undefined)
      return;
    visible.forEach((element) => {
      const record = records.get(element);
      if (!record || record.state !== "pending") return;
      observer.unobserve(element);
      if (reduced.matches) return finish(element);
      record.state = "revealing";
      element.dataset.reveal = "revealing";
      element.dataset.revealCount = String(
        Number(element.dataset.revealCount || 0) + 1,
      );
      element.style.willChange = "transform, opacity";
      const animation = animateMini(
        element,
        {
          opacity: [0, record.opacity],
          transform: [element.style.transform, record.transform || "none"],
        },
        {
          duration: record.options.duration ?? 0.8,
          delay: record.options.delay ?? 0,
          ease: [...ease],
        },
      );
      record.animation = animation;
      // Mini animate has one native animation per property. Its top-level
      // onComplete runs per property, not once for the complete reveal group.
      void animation.finished.then(() => {
        if (!disposed && record.animation === animation) finish(element);
      });
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
        const element = target as RevealElement;
        if (isIntersecting && intersectionRatio >= 0.25) visible.add(element);
        else visible.delete(element);
      });
      revealVisible();
    },
    {
      threshold: 0.25,
      rootMargin: `-${document.querySelector<HTMLElement>(".header")?.offsetHeight || 0}px 0px 0px 0px`,
    },
  );

  const register = () => {
    // A removed async card must not retain an observer or animation reference.
    records.forEach((record, element) => {
      if (scope.contains(element)) return;
      record.animation?.stop();
      observer.unobserve(element);
      visible.delete(element);
      restore(element);
      records.delete(element);
    });
    groups.forEach(({ selector, stagger = 0, ...options }) => {
      const elements =
        selector === ":scope"
          ? [scope]
          : scope.querySelectorAll<RevealElement>(selector);
      elements.forEach((element, index) => {
        if (records.has(element)) return;
        const computed = getComputedStyle(element);
        records.set(element, {
          options: {
            ...options,
            delay: (options.delay || 0) + Math.min(index * stagger, 0.36),
          },
          original: ownedStyles.map((property) => ({
            property,
            value: element.style.getPropertyValue(property),
            priority: element.style.getPropertyPriority(property),
          })),
          transform: computed.transform === "none" ? "" : computed.transform,
          opacity: Number(computed.opacity),
          state: "pending",
        });
        if (reduced.matches) finish(element);
        else {
          prepare(element);
          observer.observe(element);
        }
      });
    });
  };

  const onPreference = () => {
    if (reduced.matches) records.forEach((_, element) => finish(element));
  };
  const onBreakpoint = () => {
    records.forEach((record, element) => {
      if (record.state === "pending") prepare(element);
    });
  };
  const onPanelSettled = () => {
    if (settlementFrame !== undefined) cancelAnimationFrame(settlementFrame);
    // Navigation ends inside GSAP's rAF. A keyboard/resize interruption can
    // also precede native scrolling. Let a full render/observer cycle update
    // visibility before consuming a target's once-only entrance.
    settlementFrame = requestAnimationFrame(() => {
      settlementFrame = requestAnimationFrame(() => {
        settlementFrame = undefined;
        revealVisible();
      });
    });
  };
  // Keyboard focus and an early click must never land on an invisible control.
  const onInteract = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    records.forEach((record, element) => {
      if (record.state !== "revealed" && element.contains(target))
        finish(element);
    });
  };

  register();
  // Only enabled for async community content, never for Leaflet's DOM tree.
  const additions = watchChildren ? new MutationObserver(register) : undefined;
  additions?.observe(scope, { childList: true, subtree: true });
  reduced.addEventListener("change", onPreference);
  mobile.addEventListener("change", onBreakpoint);
  scope.addEventListener("focusin", onInteract);
  scope.addEventListener("pointerdown", onInteract, true);
  window.addEventListener(panelSettledEvent, onPanelSettled);

  return () => {
    disposed = true;
    observer.disconnect();
    additions?.disconnect();
    reduced.removeEventListener("change", onPreference);
    mobile.removeEventListener("change", onBreakpoint);
    scope.removeEventListener("focusin", onInteract);
    scope.removeEventListener("pointerdown", onInteract, true);
    window.removeEventListener(panelSettledEvent, onPanelSettled);
    if (settlementFrame !== undefined) cancelAnimationFrame(settlementFrame);
    records.forEach((record, element) => {
      record.animation?.stop();
      restore(element);
      delete element.dataset.reveal;
      delete element.dataset.revealCount;
    });
    records.clear();
    visible.clear();
  };
}

export function useScrollScene(
  root: RefObject<HTMLElement | null>,
  groups: readonly RevealGroup[],
  watchChildren = false,
) {
  useLayoutEffect(() => {
    if (root.current)
      return setupScrollScene(root.current, groups, watchChildren);
  }, [root, groups, watchChildren]);
}
