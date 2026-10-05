/** Shared timing bridge: section scrolling and element entrances never compete. */
let navigating = false;

export const panelSettledEvent = "home-panel-settled";

export function isPanelNavigating() {
  return navigating;
}

export function setPanelNavigating(value: boolean) {
  const changed = navigating !== value;
  navigating = value;
  if (changed && !value) window.dispatchEvent(new Event(panelSettledEvent));
}
