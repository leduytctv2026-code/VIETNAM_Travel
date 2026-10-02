"use client";
import { useRef } from "react";
import { motion, useScroll } from "framer-motion";
import type { HistoryEvent } from "../../../shared/domain";
import { useLanguage } from "../LanguageProvider";
import Photo from "../ui/Photo";
import { useHydratedReducedMotion } from "./useHydratedReducedMotion";
export default function Timeline({ events }: { events: HistoryEvent[] }) {
  const { t } = useLanguage();
  if (!events.length)
    return (
      <p className="empty-copy">
        {t(
          "Các dấu mốc đang được biên tập từ tư liệu có nguồn.",
          "Milestones are being prepared from referenced sources.",
        )}
      </p>
    );
  return <AnimatedTimeline events={events} />;
}
function AnimatedTimeline({ events }: { events: HistoryEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useHydratedReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 60%"],
  });
  const { t, content } = useLanguage();
  return (
    <div className="history-timeline" ref={ref}>
      <motion.div
        className="timeline-progress"
        style={{ scaleY: reduced ? 1 : scrollYProgress }}
      />
      {events.map((event, i) => (
        <motion.article
          key={i}
          initial={reduced ? false : { opacity: 0.3 }}
          whileInView={{ opacity: 1 }}
          viewport={{ amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <span className="timeline-dot" />
          <span className="timeline-year">{event.year}</span>
          <h3>{content(event.title)}</h3>
          <p>{content(event.description)}</p>
          {event.image && (
            <motion.div
              initial={reduced ? false : { clipPath: "inset(0 0 100% 0)" }}
              whileInView={{ clipPath: "inset(0 0 0% 0)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Photo src={event.image} alt={content(event.title)} />
            </motion.div>
          )}
          {event.source && (
            <a href={event.source} target="_blank" rel="noreferrer">
              {t("Nguồn tư liệu", "Reference")} ↗
            </a>
          )}
        </motion.article>
      ))}
    </div>
  );
}
