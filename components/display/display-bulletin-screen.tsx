"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { BulletinItem } from "@/lib/bulletin-board";

type DisplayBulletinScreenProps = {
  items: BulletinItem[];
  secondsPerItem: number;
};

export function DisplayBulletinScreen({ items, secondsPerItem }: DisplayBulletinScreenProps) {
  const [itemIndex, setItemIndex] = useState(0);
  const count = items.length;
  const safeIndex = count ? itemIndex % count : 0;
  const current = count ? items[safeIndex] : null;

  useEffect(() => {
    setItemIndex(0);
  }, [items]);

  useEffect(() => {
    if (count <= 1) return;
    const durationMs = Math.max(5, secondsPerItem) * 1000;
    const timer = setTimeout(() => setItemIndex((prev) => (prev + 1) % count), durationMs);
    return () => clearTimeout(timer);
  }, [count, safeIndex, secondsPerItem]);

  if (!count || !current) {
    return (
      <section className="display-bulletin-screen">
        <p className="display-bulletin-empty">אין הודעות בלוח המודעות.</p>
      </section>
    );
  }

  return (
    <section className="display-bulletin-screen" aria-label="לוח מודעות">
      <div className="display-bulletin-body">
        {current.kind === "image" && current.imageUrl ? (
          <div className="display-bulletin-image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.imageUrl}
              alt={current.title?.trim() || "פרסום בלוח המודעות"}
              className="display-bulletin-image"
            />
          </div>
        ) : null}
        {current.title?.trim() ? <h2 className="display-bulletin-title">{current.title}</h2> : null}
        {current.kind === "text" && current.bodyText?.trim() ? (
          <p className="display-bulletin-text">{current.bodyText}</p>
        ) : null}
        {current.kind === "image" && current.bodyText?.trim() ? (
          <p className="display-bulletin-caption">{current.bodyText}</p>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="display-bulletin-dots" role="tablist" aria-label="מיקום בהודעות לוח המודעות">
          {items.map((item, i) => (
            <span
              key={item.id}
              role="tab"
              aria-selected={i === safeIndex}
              className={cn(
                "display-bulletin-dot",
                i === safeIndex && "display-bulletin-dot--active"
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
