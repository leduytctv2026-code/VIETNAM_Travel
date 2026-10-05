// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  revealTransform,
  setupScrollScene,
} from "../../src/components/motion/ScrollScene";
import {
  isPanelNavigating,
  setPanelNavigating,
} from "../../src/components/motion/panelNavigation";

const animation = vi.hoisted(() => ({ animate: vi.fn(), stop: vi.fn() }));
vi.mock("framer-motion", () => ({ animateMini: animation.animate }));

let callback: IntersectionObserverCallback;
let preference: EventTarget & { matches: boolean };
let cleanup: (() => void) | undefined;
const unobserve = vi.fn();
const disconnect = vi.fn();
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const cancelFrame = vi.fn((id: number) => frames.delete(id));

function renderFrame() {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((frame) => frame(performance.now()));
}

function completion() {
  let complete!: () => void;
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { finished, complete };
}

const running: {
  opacity: ReturnType<typeof completion>;
  transform: ReturnType<typeof completion>;
}[] = [];

async function completeAnimation(index = 0) {
  running[index].opacity.complete();
  running[index].transform.complete();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  setPanelNavigating(false);
  running.length = 0;
  frames.clear();
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, frame);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  preference = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("reduce")
      ? preference
      : Object.assign(new EventTarget(), { matches: false }),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(fn: IntersectionObserverCallback) {
        callback = fn;
      }
      observe = vi.fn();
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
  animation.animate.mockImplementation(() => {
    const opacity = completion();
    const transform = completion();
    running.push({ opacity, transform });
    return {
      stop: animation.stop,
      finished: Promise.all([opacity.finished, transform.finished]),
    };
  });
  document.body.innerHTML =
    '<section><div class="item" style="opacity:0.65; transform:translateX(-50%); transition:transform 200ms">Text</div></section>';
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 180,
    left: 80,
    width: 200,
    height: 40,
    bottom: 220,
    right: 280,
    x: 80,
    y: 180,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  setPanelNavigating(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(element: Element, ratio = 0.5) {
  callback(
    [
      {
        target: element,
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver,
  );
}

describe("shared editorial scroll reveal", () => {
  it("supports six directions and clamps mobile translations", () => {
    expect(revealTransform({ direction: "left" }, false)).toContain("-80px");
    expect(revealTransform({ direction: "right" }, true)).toContain("36px");
    expect(revealTransform({ direction: "up", distance: 80 }, true)).toContain(
      "40px",
    );
    expect(revealTransform({ direction: "down" }, false)).toContain("-60px");
    expect(revealTransform({ direction: "scale" }, false)).toContain(
      "scale(0.96)",
    );
    expect(revealTransform({ direction: "fade" }, false)).toContain(
      "translate3d(0px, 0px, 0)",
    );
  });

  it("waits for 25% visibility and both animated properties before restoring CSS, then stays once-only", async () => {
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [
      { selector: ".item", direction: "left" },
    ]);
    expect(item.style.opacity).toBe("0");
    expect(item.style.transform).toContain("translateX(-50%)");
    enter(item, 0.1);
    expect(animation.animate).not.toHaveBeenCalled();
    enter(item);
    enter(item);
    expect(animation.animate).toHaveBeenCalledTimes(1);
    expect(item.dataset.reveal).toBe("revealing");
    expect(item.style.opacity).toBe("0");
    running[0].opacity.complete();
    await Promise.resolve();
    expect(item.dataset.reveal).toBe("revealing");
    expect(item.style.opacity).toBe("0");
    expect(item.style.transition).toBe("none");
    expect(item.style.transform).toContain("translate3d(-80px");
    await completeAnimation();
    expect(item.style.opacity).toBe("0.65");
    expect(item.style.transform).toBe("translateX(-50%)");
    expect(item.style.transition).toBe("transform 200ms");
    expect(item.dataset.reveal).toBe("revealed");
    enter(item);
    expect(animation.animate).toHaveBeenCalledTimes(1);
    cleanup();
    expect(item.dataset.reveal).toBeUndefined();
    expect(disconnect).toHaveBeenCalled();
  });

  it("reveals immediately for initial and live reduced-motion preferences", () => {
    preference.matches = true;
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    expect(item.style.opacity).toBe("0.65");
    expect(animation.animate).not.toHaveBeenCalled();
    cleanup();
    preference.matches = false;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    enter(item);
    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
    expect(item.style.opacity).toBe("0.65");
    expect(item.dataset.reveal).toBe("revealed");
    expect(animation.stop).toHaveBeenCalled();
  });

  it("queues visible entrances until wheel navigation lands and does not replay", async () => {
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    setPanelNavigating(true);
    expect(isPanelNavigating()).toBe(true);
    enter(item);
    enter(item);
    expect(item.dataset.reveal).toBe("pending");
    expect(item.style.opacity).toBe("0");
    expect(animation.animate).not.toHaveBeenCalled();
    setPanelNavigating(false);
    expect(isPanelNavigating()).toBe(false);
    expect(item.dataset.reveal).toBe("pending");
    enter(item);
    expect(animation.animate).not.toHaveBeenCalled();
    renderFrame();
    expect(item.dataset.reveal).toBe("pending");
    renderFrame();
    expect(item.dataset.reveal).toBe("revealing");
    expect(animation.animate).toHaveBeenCalledTimes(1);
    await completeAnimation();
    expect(item.dataset.reveal).toBe("revealed");
    setPanelNavigating(true);
    enter(item);
    setPanelNavigating(false);
    renderFrame();
    renderFrame();
    expect(animation.animate).toHaveBeenCalledTimes(1);
  });

  it("does not consume a once-only entrance for a target passed before landing", async () => {
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    setPanelNavigating(true);
    enter(item);
    enter(item, 0);
    setPanelNavigating(false);
    renderFrame();
    renderFrame();
    expect(item.dataset.reveal).toBe("pending");
    expect(animation.animate).not.toHaveBeenCalled();
    enter(item);
    expect(animation.animate).toHaveBeenCalledTimes(1);
    await completeAnimation();
    expect(item.dataset.reveal).toBe("revealed");
  });

  it("refreshes stale visibility after settling before consuming an entrance", async () => {
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    setPanelNavigating(true);
    enter(item);
    setPanelNavigating(false);
    expect(item.dataset.reveal).toBe("pending");
    renderFrame();
    // Resize or keyboard default scrolling delivers a newer observer exit
    // after the navigation callback, before the deferred entrance flush.
    enter(item, 0);
    renderFrame();
    expect(item.dataset.reveal).toBe("pending");
    expect(item.dataset.revealCount).toBeUndefined();
    expect(animation.animate).not.toHaveBeenCalled();
    enter(item);
    expect(animation.animate).toHaveBeenCalledTimes(1);
    await completeAnimation();
    expect(item.dataset.reveal).toBe("revealed");
  });

  it.each([0, 1])(
    "cancels deferred settlement on cleanup after %i rendered frames",
    (renderedFrames) => {
      const scope = document.querySelector("section")!;
      const item = scope.querySelector<HTMLElement>(".item")!;
      cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
      setPanelNavigating(true);
      enter(item);
      setPanelNavigating(false);
      for (let index = 0; index < renderedFrames; index++) renderFrame();
      expect(frames.size).toBe(1);
      const scheduledFrame = [...frames.keys()][0];
      cleanup();
      cleanup = undefined;
      expect(cancelFrame).toHaveBeenCalledWith(scheduledFrame);
      expect(frames.size).toBe(0);
      renderFrame();
      renderFrame();
      expect(animation.animate).not.toHaveBeenCalled();
      expect(item.dataset.reveal).toBeUndefined();
      expect(item.style.opacity).toBe("0.65");
      expect(item.style.transform).toBe("translateX(-50%)");
    },
  );

  it("ignores stale animation completion after cleanup, including a new scene setup", async () => {
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    enter(item);
    cleanup();
    cleanup = undefined;
    expect(item.dataset.reveal).toBeUndefined();
    expect(item.style.opacity).toBe("0.65");
    await completeAnimation();
    expect(item.dataset.reveal).toBeUndefined();
    expect(item.style.opacity).toBe("0.65");

    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    enter(item);
    cleanup();
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    await completeAnimation(1);
    expect(item.dataset.reveal).toBe("pending");
    expect(item.style.opacity).toBe("0");
    enter(item);
    await completeAnimation(2);
    expect(item.dataset.reveal).toBe("revealed");
  });

  it("ignores stale completion after focus forces an entrance visible", async () => {
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }]);
    enter(item);
    item.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(item.dataset.reveal).toBe("revealed");
    expect(item.style.opacity).toBe("0.65");
    item.style.transform = "translateX(4px)";
    await completeAnimation();
    expect(item.style.transform).toBe("translateX(4px)");
    expect(item.dataset.revealCount).toBe("1");
  });

  it("registers async cards without replaying existing targets, and exposes focused controls", async () => {
    const scope = document.querySelector("section")!;
    const item = scope.querySelector<HTMLElement>(".item")!;
    cleanup = setupScrollScene(scope, [{ selector: ".item" }], true);
    item.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(item.dataset.reveal).toBe("revealed");
    const added = document.createElement("button");
    added.className = "item";
    scope.append(added);
    await Promise.resolve();
    expect(added.dataset.reveal).toBe("pending");
    expect(item.dataset.reveal).toBe("revealed");
    enter(added);
    expect(animation.animate).toHaveBeenCalledTimes(1);
    added.remove();
    await Promise.resolve();
    expect(animation.stop).toHaveBeenCalled();
  });
});
