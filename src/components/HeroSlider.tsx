"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { MapPin } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import Photo from "./ui/Photo";
import type { Content } from "../../shared/domain";
import { imageOf, related } from "@/lib/content";

const PLACEHOLDER_IMAGE = "/images/image-placeholder.svg";

function provinceImage(item: Content | undefined) {
  if (!item) return PLACEHOLDER_IMAGE;
  const directImage = imageOf(item);
  if (directImage !== PLACEHOLDER_IMAGE) return directImage;
  const region = related(item.regionId);
  return region ? imageOf(region) : PLACEHOLDER_IMAGE;
}

function carouselX(
  viewport: HTMLElement,
  track: HTMLElement,
  card: HTMLElement,
) {
  const focalRatio = window.innerWidth >= 1024 ? 0.4 : 0.45;
  const cardCenter = card.offsetLeft + card.offsetWidth / 2;
  const desired = viewport.clientWidth * focalRatio - cardCenter;
  const minimum = Math.min(0, viewport.clientWidth - track.scrollWidth);
  return gsap.utils.clamp(minimum, 0, desired);
}

function titleLengthClass(label: string) {
  if (label.length > 20) return "is-very-long";
  if (label.length > 12) return "is-long";
  return "";
}

export default function HeroSlider({ provinces }: { provinces: Content[] }) {
  const { t, content } = useLanguage();
  const initialIndex = Math.max(
    provinces.findIndex((province) => province.slug === "an-giang"),
    0,
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [autoplayRestart, setAutoplayRestart] = useState(0);
  const target = useRef<HTMLElement>(null);
  const carouselViewport = useRef<HTMLDivElement>(null);
  const carouselTrack = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const hoveringCarousel = useRef(false);
  const autoplayDirection = useRef<1 | -1>(1);
  const previousIndex = useRef(initialIndex);
  const scrollHint = useRef<gsap.core.Tween | null>(null);
  const activeProvince = provinces[activeIndex];
  const previousProvince = provinces[previousIndex.current] || activeProvince;
  const activeName = activeProvince
    ? content(activeProvince.name)
    : t("Việt Nam", "Vietnam");
  const previousName = previousProvince
    ? content(previousProvince.name)
    : t("Việt Nam", "Vietnam");

  const selectProvince = useCallback(
    (nextIndex: number) => {
      if (!provinces.length) return;
      const boundedIndex = Math.max(0, Math.min(nextIndex, provinces.length - 1));
      setActiveIndex(boundedIndex);
      setAutoplayRestart((value) => value + 1);
    },
    [provinces.length],
  );

  useLayoutEffect(() => {
    if (!target.current) return;

    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          desktop: "(min-width: 1024px) and (min-height: 640px)",
        },
        (match) => {
          const select = gsap.utils.selector(target.current!);
          const cardMotions = select(".hero-card-motion");
          const activeCardMotion = target.current?.querySelector<HTMLElement>(
            '.hero-card[data-active="true"] .hero-card-motion',
          );

          gsap.set(cardMotions, { autoAlpha: 0.72, y: 14, scale: 0.91 });
          if (activeCardMotion) {
            gsap.set(activeCardMotion, { autoAlpha: 1, y: 0, scale: 1 });
          }
          if (!match.conditions?.motion) return;

          const desktop = Boolean(match.conditions.desktop);
          const timeline = gsap.timeline({ defaults: { ease: "power4.out" } });
          timeline
            .addLabel("image", 0)
            .fromTo(
              select(".hero-load-image"),
              {
                scale: desktop ? 1.08 : 1.04,
                filter: "blur(8px)",
                clipPath: "inset(0 0 100% 0)",
              },
              {
                scale: 1,
                filter: "blur(0px)",
                clipPath: "inset(0 0 0% 0)",
                duration: desktop ? 1.8 : 0.8,
                ease: "power3.out",
              },
              "image",
            )
            .addLabel("type", 0.22)
            .fromTo(
              select(".hero-opening-line"),
              { yPercent: 115, rotate: 3 },
              {
                yPercent: 0,
                rotate: 0,
                duration: desktop ? 1.15 : 0.55,
                stagger: 0.1,
              },
              "type",
            )
            .fromTo(
              select(".hero-card-carousel"),
              { autoAlpha: 0, y: 90 },
              {
                autoAlpha: 1,
                y: 0,
                duration: desktop ? 1.05 : 0.58,
                ease: "power4.out",
              },
              desktop ? 1.02 : 0.58,
            )
            .fromTo(
              select(".hero-bottom"),
              { autoAlpha: 0, y: 18 },
              { autoAlpha: 1, y: 0, duration: 0.7 },
              "-=0.2",
            );

          scrollHint.current = gsap.to(select(".scroll-hint-icon"), {
            y: 8,
            duration: 1.35,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            paused: !visible.current,
          });
          return () => {
            scrollHint.current = null;
          };
        },
      );

      media.add(
        "(min-width: 1024px) and (min-height: 640px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
        () => {
          const root = target.current!;
          const background = root.querySelector<HTMLElement>(
            ".hero-background-parallax",
          );
          const copy = root.querySelector<HTMLElement>(".hero-copy-parallax");
          const cards = root.querySelector<HTMLElement>(
            ".hero-card-deck-parallax",
          );
          if (!background || !copy || !cards) return;

          const backgroundX = gsap.quickTo(background, "x", {
            duration: 0.8,
            ease: "power3.out",
          });
          const backgroundY = gsap.quickTo(background, "y", {
            duration: 0.8,
            ease: "power3.out",
          });
          const copyX = gsap.quickTo(copy, "x", {
            duration: 0.65,
            ease: "power3.out",
          });
          const copyY = gsap.quickTo(copy, "y", {
            duration: 0.65,
            ease: "power3.out",
          });
          const cardsX = gsap.quickTo(cards, "x", {
            duration: 0.7,
            ease: "power3.out",
          });
          const cardsY = gsap.quickTo(cards, "y", {
            duration: 0.7,
            ease: "power3.out",
          });
          const reset = () => {
            backgroundX(0);
            backgroundY(0);
            copyX(0);
            copyY(0);
            cardsX(0);
            cardsY(0);
          };
          const move = (event: PointerEvent) => {
            const bounds = root.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width - 0.5;
            const y = (event.clientY - bounds.top) / bounds.height - 0.5;
            backgroundX(x * 16);
            backgroundY(y * 16);
            copyX(x * 8);
            copyY(y * 8);
            cardsX(x * 24);
            cardsY(y * 20);
          };
          root.addEventListener("pointermove", move);
          root.addEventListener("pointerleave", reset);
          return () => {
            root.removeEventListener("pointermove", move);
            root.removeEventListener("pointerleave", reset);
            gsap.killTweensOf([background, copy, cards]);
          };
        },
      );
    }, target.current);

    return () => {
      media.revert();
      context.revert();
    };
  }, [provinces.length]);

  useLayoutEffect(() => {
    const root = target.current;
    const viewport = carouselViewport.current;
    const track = carouselTrack.current;
    if (!root || !viewport || !track || !activeProvince) return;

    const card = root.querySelector<HTMLElement>(
      `.hero-card[data-province-index="${activeIndex}"]`,
    );
    if (!card) return;

    const oldIndex = previousIndex.current;
    const oldCardMotion = root.querySelector<HTMLElement>(
      `.hero-card[data-province-index="${oldIndex}"] .hero-card-motion`,
    );
    const newCardMotion = card.querySelector<HTMLElement>(".hero-card-motion");
    const outgoingBackground = root.querySelector<HTMLElement>(
      ".hero-background-outgoing",
    );
    const incomingBackground = root.querySelector<HTMLElement>(
      ".hero-background-incoming",
    );
    const outgoingTitle = root.querySelector<HTMLElement>(
      ".hero-place-title-outgoing",
    );
    const incomingTitle = root.querySelector<HTMLElement>(
      ".hero-place-title-incoming",
    );
    const targetX = carouselX(viewport, track, card);
    const changed = oldIndex !== activeIndex;
    const direction = activeIndex > oldIndex ? 1 : -1;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const reposition = () => {
      const currentCard = root.querySelector<HTMLElement>(
        `.hero-card[data-province-index="${activeIndex}"]`,
      );
      if (currentCard) {
        gsap.set(track, { x: carouselX(viewport, track, currentCard) });
      }
    };
    window.addEventListener("resize", reposition);

    if (!changed) {
      gsap.set(track, { x: targetX });
      gsap.set(outgoingBackground, { autoAlpha: 0, zIndex: 0 });
      gsap.set(incomingBackground, {
        autoAlpha: 1,
        zIndex: 2,
        clipPath: "inset(0%)",
      });
      gsap.set(outgoingTitle, {
        autoAlpha: 0,
        xPercent: 0,
        filter: "blur(0px)",
      });
      gsap.set(incomingTitle, {
        autoAlpha: 1,
        xPercent: 0,
        filter: "blur(0px)",
      });
      gsap.set(oldCardMotion, {
        autoAlpha: changed ? 0.72 : 1,
        y: changed ? 14 : 0,
        scale: changed ? 0.91 : 1,
      });
      gsap.set(newCardMotion, { autoAlpha: 1, y: 0, scale: 1 });
      previousIndex.current = activeIndex;
      return () => window.removeEventListener("resize", reposition);
    }

    gsap.killTweensOf([
      track,
      outgoingBackground,
      incomingBackground,
      outgoingTitle,
      incomingTitle,
      oldCardMotion,
      newCardMotion,
    ]);
    const incomingClip =
      direction > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
    gsap.set(outgoingBackground, { autoAlpha: 1, zIndex: 1 });
    gsap.set(incomingBackground, {
      autoAlpha: 1,
      zIndex: 2,
      clipPath: incomingClip,
    });
    gsap.set(outgoingTitle, {
      autoAlpha: 1,
      xPercent: 0,
      filter: "blur(0px)",
    });
    gsap.set(incomingTitle, {
      autoAlpha: 0,
      xPercent: direction * 30,
      filter: "blur(5px)",
    });

    const trackDuration = reducedMotion ? 0.42 : 0.72;
    const cardDuration = reducedMotion ? 0.34 : 0.56;
    const backgroundDuration = reducedMotion ? 0.44 : 0.72;
    const outgoingDuration = reducedMotion ? 0.34 : 0.54;
    const handoffStart = reducedMotion ? 0.02 : 0.04;
    const timeline = gsap.timeline({ defaults: { ease: "power3.inOut" } });
    timeline
      .addLabel("handoff", handoffStart)
      .to(
        track,
        { x: targetX, duration: trackDuration, ease: "power4.inOut" },
        0,
      )
      .to(
        oldCardMotion,
        {
          autoAlpha: 0.68,
          y: 18,
          scale: 0.9,
          duration: reducedMotion ? 0.26 : 0.44,
        },
        0,
      )
      .fromTo(
        newCardMotion,
        {
          autoAlpha: 0.54,
          x: direction * 22,
          y: 30,
          scale: 0.86,
          rotationY: direction * -10,
          transformPerspective: 900,
        },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotationY: 0,
          duration: cardDuration,
          ease: "power4.out",
        },
        reducedMotion ? 0.06 : 0.12,
      )
      .to(
        outgoingBackground,
        { autoAlpha: 0.16, duration: outgoingDuration },
        0,
      )
      .to(
        outgoingBackground?.querySelector("img") || [],
        { scale: 1.04, duration: reducedMotion ? 0.44 : 0.72 },
        0,
      )
      .to(
        incomingBackground,
        {
          clipPath: "inset(0% 0 0 0)",
          duration: backgroundDuration,
          ease: "power4.inOut",
        },
        "handoff",
      )
      .fromTo(
        incomingBackground?.querySelector("img") || [],
        { scale: 1.08 },
        {
          scale: 1,
          duration: reducedMotion ? 0.52 : 0.9,
          ease: "power3.out",
        },
        "handoff",
      )
      .to(
        outgoingTitle,
        {
          autoAlpha: 0,
          xPercent: direction * -28,
          filter: "blur(7px)",
          duration: outgoingDuration,
        },
        0,
      )
      .to(
        incomingTitle,
        {
          autoAlpha: 1,
          xPercent: 0,
          filter: "blur(0px)",
          duration: backgroundDuration,
          ease: "power3.out",
        },
        "handoff",
      )
      .set(
        outgoingBackground,
        { autoAlpha: 0 },
        handoffStart + backgroundDuration + 0.04,
      );

    previousIndex.current = activeIndex;

    return () => {
      window.removeEventListener("resize", reposition);
      timeline.kill();
    };
  }, [activeIndex, activeProvince]);

  useEffect(() => {
    if (!target.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        scrollHint.current?.paused(!entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(target.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (provinces.length < 2) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (
        document.hidden ||
        !visible.current ||
        hoveringCarousel.current ||
        preference.matches
      ) {
        return;
      }
      let nextIndex = activeIndex + autoplayDirection.current;
      if (nextIndex >= provinces.length) {
        autoplayDirection.current = -1;
        nextIndex = provinces.length - 2;
      } else if (nextIndex < 0) {
        autoplayDirection.current = 1;
        nextIndex = 1;
      }
      selectProvince(nextIndex);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeIndex, autoplayRestart, provinces.length, selectProvince]);

  return (
    <section
      ref={target}
      className="hero heritage-hero"
      aria-roledescription={t("Trình chiếu", "Carousel")}
      aria-label={t(
        "Khám phá 63 tỉnh thành Việt Nam",
        "Explore Vietnam's 63 provinces",
      )}
    >
      <div className="hero-camera">
        <div className="hero-background-parallax">
          <div className="hero-load-image">
            <div
              className="slider-layer hero-background-outgoing"
              aria-hidden="true"
            >
              <Photo
                src={provinceImage(previousProvince)}
                alt=""
                fill
                sizes="100vw"
                className="hero-image"
              />
            </div>
            <div
              className="slider-layer hero-background-incoming"
              aria-hidden="false"
            >
              <Photo
                src={provinceImage(activeProvince)}
                alt={
                  activeProvince
                    ? content(activeProvince.name)
                    : t("Di sản Việt Nam", "Vietnam heritage")
                }
                fill
                priority
                sizes="100vw"
                className="hero-image"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="hero-shade" />
      <div className="hero-scroll-shade" aria-hidden="true" />
      <div className="hero-content-scroll">
        <div className="hero-content">
          <div className="hero-copy-parallax">
            <h1
              className="hero-title"
              aria-label={activeName}
            >
              <span
                className="hero-line-mask hero-place-mask"
                aria-hidden="true"
              >
                <span className="hero-place-stack hero-opening-line">
                  <em
                    className={`hero-place-title hero-place-title-outgoing ${titleLengthClass(previousName)}`}
                  >
                    {previousName}
                  </em>
                  <em
                    className={`hero-place-title hero-place-title-incoming ${titleLengthClass(activeName)}`}
                  >
                    {activeName}
                  </em>
                </span>
              </span>
            </h1>
          </div>
        </div>

        {!!provinces.length && (
          <div className="hero-card-deck-parallax">
            <div
              ref={carouselViewport}
              className="hero-card-carousel"
              role="group"
              aria-label={t("Chọn tỉnh thành", "Choose a province")}
              onPointerEnter={() => {
                hoveringCarousel.current = true;
              }}
              onPointerLeave={() => {
                hoveringCarousel.current = false;
              }}
              onFocusCapture={() => {
                hoveringCarousel.current = true;
              }}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  hoveringCarousel.current = false;
                }
              }}
            >
              <div ref={carouselTrack} className="hero-card-deck">
                {provinces.map((province, cardIndex) => {
                  const region = related(province.regionId);
                  const imageIsNearby = Math.abs(cardIndex - activeIndex) <= 3;
                  return (
                    <button
                      className="hero-card"
                      type="button"
                      key={province._id}
                      aria-label={`${t("Hiển thị", "Show")} ${content(province.name)}`}
                      aria-pressed={cardIndex === activeIndex}
                      data-active={cardIndex === activeIndex ? "true" : "false"}
                      data-province-index={cardIndex}
                      onClick={() => selectProvince(cardIndex)}
                    >
                      <span className="hero-card-motion">
                        <span className="hero-card-inner">
                          <span className="hero-card-media">
                            <Photo
                              src={
                                imageIsNearby
                                  ? provinceImage(province)
                                  : PLACEHOLDER_IMAGE
                              }
                              alt=""
                              fill
                              priority={Math.abs(cardIndex - activeIndex) <= 1}
                              sizes="(min-width: 1024px) 236px, 164px"
                            />
                          </span>
                          <span className="hero-card-shade" />
                          <span className="hero-card-copy">
                            <small>
                              {region
                                ? content(region.name)
                                : t("Tỉnh thành", "Province")}
                            </small>
                            <strong
                              className={titleLengthClass(
                                content(province.name),
                              )}
                            >
                              {content(province.name)}
                            </strong>
                          </span>
                          <span className="hero-card-index">
                            {String(cardIndex + 1).padStart(2, "0")}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="hero-bottom-scroll">
        <div className="hero-bottom">
          {activeProvince && (
            <Link
              className="hero-caption"
              href={`/province/${activeProvince.slug}`}
            >
              <MapPin size={15} />
              <strong>{content(activeProvince.name)}</strong>
              <span>{t("Xem hồ sơ tỉnh thành", "View province profile")}</span>
            </Link>
          )}
          <a className="scroll-hint" href="#country">
            {t("CUỘN ĐỂ KHÁM PHÁ", "SCROLL TO EXPLORE")}{" "}
            <span className="scroll-hint-icon" aria-hidden="true">
              ↓
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
