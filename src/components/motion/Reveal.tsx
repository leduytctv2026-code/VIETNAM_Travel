"use client";

/**
 * Semantic grouping only. The global GSAP motion system owns scroll-triggered
 * reveals, preventing competing animation loops inside page components.
 */
export default function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "fade";
}) {
  return <div className={className}>{children}</div>;
}
