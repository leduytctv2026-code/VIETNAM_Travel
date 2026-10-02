"use client";
import Image from "next/image";
import { useState } from "react";
export default function Photo({
  src,
  alt,
  className,
  priority = false,
  fill = false,
  sizes = "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
}) {
  const [failedSource, setFailedSource] = useState("");
  const source = failedSource === src
    ? "/images/image-placeholder.svg"
    : src || "/images/image-placeholder.svg";
  return (
    <Image
      src={source}
      alt={alt}
      {...(fill ? { fill: true } : { width: 1200, height: 800 })}
      sizes={sizes}
      className={className}
      preload={priority}
      unoptimized={
        source.startsWith("/api/") ||
        (!source.startsWith("/") &&
          !source.startsWith("https://images.unsplash.com/"))
      }
      onError={() => setFailedSource(src)}
      style={{ objectFit: "cover", ...(fill ? {} : { aspectRatio: "3 / 2" }) }}
    />
  );
}
