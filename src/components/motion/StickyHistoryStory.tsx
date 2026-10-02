"use client";

import Link from "next/link";
import type { Content } from "../../../shared/domain";
import { useLanguage } from "../LanguageProvider";
import { imageOf } from "@/lib/content";
import Photo from "../ui/Photo";

export default function StickyHistoryStory({ item }: { item?: Content }) {
  if (!item) return null;

  return <HistoryStory item={item} />;
}

function HistoryStory({ item }: { item: Content }) {
  const { t, content } = useLanguage();
  const events = item.history?.events || [];
  const title = t(
    "L\u1ecbch s\u1eed kh\u00f4ng \u0111\u1ee9ng y\u00ean.",
    "History is never still.",
  );

  return (
    <section className="history-stage memory-scene">
      <div className="history-visual">
        <div className="history-media">
          <Photo
            src={imageOf(item)}
            alt={content(item.name)}
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
          />
        </div>
        <div className="history-visual-copy">
          <span>
            {t(
              "H\u00c0NH TR\u00ccNH QUA L\u1ecaCH S\u1eec",
              "A JOURNEY THROUGH HISTORY",
            )}
          </span>
          <strong>
            {t("Nh\u1eefng l\u1edbp th\u1eddi gian.", "Layers of time.")}
          </strong>
        </div>
      </div>
      <div
        className="history-copy"
        data-lenis-prevent
        tabIndex={0}
        role="region"
        aria-label={title}
      >
        <div className="eyebrow light">
          {t(
            "K\u00dd \u1ee8C \u0110\u01af\u1ee2C G\u1eccI T\u00caN",
            "MEMORY, MADE VISIBLE",
          )}
        </div>
        <h2 className="memory-title-mask">
          <span className="memory-title-line">{title}</span>
        </h2>
        <p>{content(item.history?.summary)}</p>
        <div className="history-milestones">
          {events.map((event, index) => (
            <article
              className="history-milestone"
              key={`${event.year}-${index}`}
            >
              <span>{event.year}</span>
              <h3>{content(event.title)}</h3>
              <p>{content(event.description)}</p>
              {event.image && (
                <div className="history-event-image">
                  <Photo
                    src={event.image}
                    alt={content(event.title)}
                    fill
                    sizes="(max-width: 850px) 90vw, 40vw"
                  />
                </div>
              )}
            </article>
          ))}
        </div>
        <Link
          className="hero-secondary-action"
          href={`/province/${item.slug}#history`}
        >
          {t("M\u1edf m\u1ed9t c\u00e2u chuy\u1ec7n", "Open a story")} ↗
        </Link>
      </div>
    </section>
  );
}
