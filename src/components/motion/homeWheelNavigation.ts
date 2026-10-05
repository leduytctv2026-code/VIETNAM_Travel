import { gsap } from "gsap";
import { setPanelNavigating } from "./panelNavigation";

const wheelIdleMs = 200;
const positionTolerance = 8;

/** Only semantic panel boundaries are destinations, never partial screens. */
function homeScrollStops(main: HTMLElement) {
  const headerHeight =
    document.querySelector<HTMLElement>(".header")?.offsetHeight ?? 80;
  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  const sections = [
    ...main.querySelectorAll<HTMLElement>(":scope > [data-scene]"),
    document.querySelector<HTMLElement>(".site-footer"),
  ];
  const anchors = [
    0,
    ...sections
      .filter((section): section is HTMLElement =>
        Boolean(section && section.offsetHeight > 0),
      )
      .map((section) =>
        Math.min(
          maxScroll,
          Math.max(
            0,
            section.getBoundingClientRect().top + window.scrollY - headerHeight,
          ),
        ),
      ),
    maxScroll,
  ].sort((a, b) => a - b);
  const stops: number[] = [];
  for (const anchor of anchors) {
    const previous = stops.at(-1);
    if (previous !== undefined) {
      if (anchor - previous <= positionTolerance) continue;
    }
    stops.push(anchor);
  }
  return stops;
}

function nestedScrollConsumesWheel(target: Element, direction: number) {
  for (
    let element: Element | null = target;
    element && element !== document.body;
    element = element.parentElement
  ) {
    if (!(element instanceof HTMLElement)) continue;
    const overflow = getComputedStyle(element).overflowY;
    if (!/(auto|scroll)/.test(overflow)) continue;
    const limit = element.scrollHeight - element.clientHeight;
    if (
      limit > 1 &&
      (direction > 0 ? element.scrollTop < limit - 1 : element.scrollTop > 1)
    )
      return true;
  }
  return false;
}

export function setupHomeWheelNavigation() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animation: gsap.core.Tween | undefined;
  let gestureActive = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let previousScrollBehavior: string | undefined;
  const restoreScrollBehavior = () => {
    if (previousScrollBehavior === undefined) return;
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
    previousScrollBehavior = undefined;
  };

  const navigate = (event: WheelEvent) => {
    const main = document.querySelector<HTMLElement>("main.cinematic-home");
    const target = event.target;
    const overlay = document.querySelector(
      "dialog[open], [role='dialog'], .nav.open",
    );
    if (main && overlay && target instanceof Element) {
      // A modal backdrop can retarget its wheel events to the dialog itself.
      // Only an inner scroll area with room in that direction may consume them.
      if (
        event.cancelable &&
        !event.ctrlKey &&
        !event.metaKey &&
        Math.abs(event.deltaY) > Math.abs(event.deltaX) &&
        (!overlay.contains(target) ||
          !nestedScrollConsumesWheel(target, Math.sign(event.deltaY)))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    if (
      !main ||
      !(target instanceof Element) ||
      !event.cancelable ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      Math.abs(event.deltaY) < 1 ||
      Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
      document.body.style.overflow === "hidden" ||
      target.closest("textarea, select, [contenteditable='true']") ||
      target.closest(".leaflet-popup, .leaflet-control")
    )
      return;

    const direction = Math.sign(event.deltaY);
    if (nestedScrollConsumesWheel(target, direction)) return;

    const stops = homeScrollStops(main);
    const destination =
      direction > 0
        ? stops.find((stop) => stop > window.scrollY + positionTolerance)
        : stops.findLast((stop) => stop < window.scrollY - positionTolerance);
    if (destination === undefined && !animation && !gestureActive) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      gestureActive = false;
    }, wheelIdleMs);
    // A trackpad gesture emits many events, including its momentum tail.
    if (animation || gestureActive || destination === undefined) return;
    gestureActive = true;

    previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    if (reduced.matches) {
      window.scrollTo(0, destination);
      restoreScrollBehavior();
      return;
    }
    setPanelNavigating(true);
    const position = { y: window.scrollY };
    animation = gsap.to(position, {
      y: destination,
      duration: 0.55,
      ease: "power2.inOut",
      onUpdate: () => window.scrollTo(0, position.y),
      onComplete: () => {
        animation = undefined;
        restoreScrollBehavior();
        setPanelNavigating(false);
      },
    });
  };

  const cancelAnimation = () => {
    animation?.kill();
    animation = undefined;
    gestureActive = false;
    clearTimeout(idleTimer);
    restoreScrollBehavior();
    setPanelNavigating(false);
  };
  const interruptWithKeyboard = (event: KeyboardEvent) => {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
        "Tab",
      ].includes(event.key)
    )
      cancelAnimation();
  };
  const onMotionPreference = () => {
    // Respect a live accessibility change, even halfway through a panel move.
    if (reduced.matches) animation?.progress(1);
  };
  window.addEventListener("wheel", navigate, { capture: true, passive: false });
  window.addEventListener("pointerdown", cancelAnimation, true);
  window.addEventListener("touchstart", cancelAnimation, { passive: true });
  window.addEventListener("keydown", interruptWithKeyboard, true);
  window.addEventListener("resize", cancelAnimation);
  reduced.addEventListener("change", onMotionPreference);

  return () => {
    cancelAnimation();
    window.removeEventListener("wheel", navigate, true);
    window.removeEventListener("pointerdown", cancelAnimation, true);
    window.removeEventListener("touchstart", cancelAnimation);
    window.removeEventListener("keydown", interruptWithKeyboard, true);
    window.removeEventListener("resize", cancelAnimation);
    reduced.removeEventListener("change", onMotionPreference);
  };
}
