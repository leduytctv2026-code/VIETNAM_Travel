"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useScrollScene, type RevealOptions } from "./ScrollScene";

/** Standalone primitive using the same once-only engine as the homepage scenes. */
export default function Reveal({
  children,
  className,
  ...options
}: RevealOptions & {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { direction, distance, scale, rotate, delay, duration } = options;
  const groups = useMemo(
    () => [
      {
        selector: ":scope",
        direction,
        distance,
        scale,
        rotate,
        delay,
        duration,
      },
    ],
    [direction, distance, scale, rotate, delay, duration],
  );
  useScrollScene(root, groups);
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
