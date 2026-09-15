"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

import type { HaftarahMinhag } from "@/lib/haftarah-minhag";
import { SIDDUR_PRAYER_LABELS, type SiddurContent, type SiddurPrayer } from "@/lib/siddur";

type SiddurReaderProps = {
  prayer: SiddurPrayer;
  nusach: HaftarahMinhag;
  onClose: () => void;
};

type Payload = {
  ok?: boolean;
  content?: SiddurContent;
};

export function SiddurReader({ prayer, nusach, onClose }: SiddurReaderProps) {
  const [content, setContent] = useState<SiddurContent | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<number | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 45_000);
    setLoading(true);
    setError(false);
    setContent(null);
    setActiveSection(null);

    fetch(`/api/siddur?prayer=${encodeURIComponent(prayer)}&nusach=${encodeURIComponent(nusach)}`, {
      method: "GET",
      cache: "default",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { Accept: "application/json" }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("siddur");
        return (await res.json()) as Payload;
      })
      .then((data) => {
        if (!data?.ok || !data.content?.sections?.length) throw new Error("siddur");
        setContent(data.content);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [nusach, prayer]);

  const title = content?.prayerLabel ?? SIDDUR_PRAYER_LABELS[prayer];
  const nusachLabel = content?.nusachLabel;
  const sections = content?.sections ?? [];

  const jumpToSection = (index: number) => {
    setActiveSection(index);
    document.getElementById(`siddur-sec-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="m-siddur" role="dialog" aria-modal="true" aria-labelledby="m-siddur-title">
      <div className="m-siddur-bar">
        <button type="button" className="m-siddur-back" onClick={onClose}>
          <ChevronRight className="h-6 w-6" aria-hidden />
          חזרה ללוח הזמנים
        </button>
        {sections.length ? (
          <label className="m-siddur-jump">
            <span className="m-siddur-jump-label">מראה מקום</span>
            <span className="m-siddur-jump-field">
              <select
                className="m-siddur-jump-select"
                value={activeSection ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "") return;
                  const index = Number(raw);
                  if (Number.isInteger(index)) jumpToSection(index);
                }}
              >
                <option value="">בחירת חלק בתפילה</option>
                {sections.map((section, index) => (
                  <option key={`${section.title}-${index}`} value={index}>
                    {section.title || `חלק ${index + 1}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="m-siddur-jump-caret" aria-hidden />
            </span>
          </label>
        ) : null}
      </div>
      <div className="m-siddur-body">
        <header className="m-siddur-heading">
          <BookOpen className="h-6 w-6" aria-hidden />
          <div>
            <h2 id="m-siddur-title">{title}</h2>
            {nusachLabel ? <p>נוסח {nusachLabel}</p> : null}
          </div>
        </header>
        {content?.note ? <p className="m-siddur-note">{content.note}</p> : null}
        {loading ? <p className="m-siddur-status">טוען את נוסח התפילה…</p> : null}
        {error ? (
          <p className="m-siddur-status">לא הצלחנו לטעון את נוסח התפילה כעת. חזרו ללוח ונסו שוב.</p>
        ) : null}
        {sections.length ? (
          <nav className="m-siddur-toc" aria-label="מראה מקום">
            {sections.map((section, index) => (
              <button
                key={`${section.title}-${index}`}
                type="button"
                className={activeSection === index ? "m-siddur-toc-item is-active" : "m-siddur-toc-item"}
                onClick={() => jumpToSection(index)}
              >
                {section.title || `חלק ${index + 1}`}
              </button>
            ))}
          </nav>
        ) : null}
        {content
          ? content.sections.map((section, index) => (
              <section key={`${section.title}-${index}`} id={`siddur-sec-${index}`} className="m-siddur-section">
                {section.title ? <h3>{section.title}</h3> : null}
                <div className="m-siddur-text" dangerouslySetInnerHTML={{ __html: section.html }} />
              </section>
            ))
          : null}
        {content ? (
          <p className="m-siddur-source">
            מקור:{" "}
            <a href={content.sourceUrl} target="_blank" rel="noreferrer">
              {content.sourceLabel}
            </a>
          </p>
        ) : null}
        <button type="button" className="m-siddur-back m-siddur-back--footer" onClick={onClose}>
          <ChevronRight className="h-6 w-6" aria-hidden />
          חזרה ללוח הזמנים
        </button>
      </div>
    </div>
  );
}
