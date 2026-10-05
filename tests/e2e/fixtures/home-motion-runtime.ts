import { setupScrollScene } from "../../../src/components/motion/ScrollScene";
import { setupHomeWheelNavigation } from "../../../src/components/motion/homeWheelNavigation";
import {
  homeRevealScenes,
  footerRevealGroups,
} from "../../../src/components/motion/homeRevealScenes";

/** Exercise the production engine, selectors and wheel handler without an API. */
export function mount() {
  const cleanups = homeRevealScenes.flatMap(
    ({ selector, groups, watchChildren }) => {
      const scope = document.querySelector<HTMLElement>(selector);
      return scope ? [setupScrollScene(scope, groups, watchChildren)] : [];
    },
  );
  cleanups.push(
    setupScrollScene(
      document.querySelector<HTMLElement>("footer")!,
      footerRevealGroups,
    ),
  );
  cleanups.push(setupHomeWheelNavigation());
  return () => cleanups.forEach((cleanup) => cleanup());
}
