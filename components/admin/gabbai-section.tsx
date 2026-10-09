"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** חלק מתקפל בעמודי הגבאי. בכותרת מופיע סיכום קצר של הבחירה, כדי שלא צריך לפתוח כדי לדעת. */
export function GabbaiSection({
  title,
  summary,
  defaultOpen = false,
  children
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details className="gabbai-section" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="gabbai-section-head">
        <span className="gabbai-section-titles">
          <span className="gabbai-section-title">{title}</span>
          {summary ? <span className="gabbai-section-summary">{summary}</span> : null}
        </span>
        <ChevronDown className="gabbai-section-chevron" aria-hidden />
      </summary>
      <div className="gabbai-section-body">{children}</div>
    </details>
  );
}
