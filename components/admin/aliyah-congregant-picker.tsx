"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONGREGANT_TRIBE_LABELS, type CongregantTribe } from "@/lib/congregant-types";
import type { AliyahCongregantOption } from "@/lib/aliyah-types";

const PREFERRED_TRIBE_HEADINGS: Partial<Record<CongregantTribe, string>> = {
  kohen: "כהנים",
  levi: "לויים"
};

export function preferredTribeForSlot(slotKey: string): CongregantTribe | null {
  if (slotKey === "kohen") return "kohen";
  if (slotKey === "levi") return "levi";
  return null;
}

function haystack(row: AliyahCongregantOption) {
  return [row.displayName, row.prayerName, row.nickname, row.phone, row.lastName, row.firstName]
    .join(" ")
    .toLowerCase();
}

function rank(row: AliyahCongregantOption, minyanId: string | null, query: string) {
  let score = 0;
  if (minyanId && row.minyanId === minyanId) score += 8;
  if (row.isActive) score += 3;
  if (row.receivesAliyah) score += 2;
  if (row.registrationStatus === "approved") score += 2;
  if (query && row.displayName.startsWith(query)) score += 4;
  return score;
}

export function AliyahCongregantPicker({
  congregants,
  minyanId,
  selectedId,
  usedIds,
  preferTribe = null,
  onSelect,
  onAddNew
}: {
  congregants: AliyahCongregantOption[];
  minyanId: string | null;
  selectedId: string | null;
  usedIds: Set<string>;
  /** בכהן / לוי: מציגים קודם את בני השבט, ואחריהם את כל השאר */
  preferTribe?: CongregantTribe | null;
  onSelect: (id: string | null) => void;
  onAddNew: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [allMinyanim, setAllMinyanim] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = congregants.find((row) => row.id === selectedId) ?? null;
  const hasOtherMinyanim = useMemo(
    () => Boolean(minyanId) && congregants.some((row) => row.minyanId != null && row.minyanId !== minyanId),
    [congregants, minyanId]
  );
  const showAll = allMinyanim || !hasOtherMinyanim;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const parts = q.split(/\s+/).filter(Boolean);
    const group = (row: AliyahCongregantOption) => (preferTribe && row.tribe === preferTribe ? 0 : 1);
    const filtered = congregants.filter((row) => {
      if (!showAll && row.minyanId != null && row.minyanId !== minyanId) return false;
      if (!parts.length) return row.isActive;
      const text = haystack(row);
      return parts.every((part) => text.includes(part));
    });
    return filtered.sort(
      (a, b) =>
        group(a) - group(b) ||
        rank(b, minyanId, q) - rank(a, minyanId, q) ||
        a.displayName.localeCompare(b.displayName, "he")
    );
  }, [congregants, minyanId, query, preferTribe, showAll]);

  const preferredCount = preferTribe ? matches.filter((row) => row.tribe === preferTribe).length : 0;
  const preferredHeading = preferTribe ? PREFERRED_TRIBE_HEADINGS[preferTribe] : undefined;

  if (selected && !open) {
    return (
      <div>
        <div className="aliyah-picked">
          <strong>{selected.displayName}</strong>
          <span className="aliyah-tribe">{CONGREGANT_TRIBE_LABELS[selected.tribe]}</span>
          {selected.prayerName ? <span>{selected.prayerName}</span> : null}
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            שינוי
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onSelect(null)}>
            ניקוי
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="aliyah-picker"
      ref={rootRef}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="חיפוש שם, כינוי או טלפון"
        autoComplete="off"
        aria-label="חיפוש עולה"
      />
      {hasOtherMinyanim ? (
        <label className="aliyah-picker-scope">
          <input
            type="checkbox"
            checked={allMinyanim}
            onChange={(event) => {
              setAllMinyanim(event.target.checked);
              setOpen(true);
            }}
          />
          מכל המניינים
        </label>
      ) : null}
      {open ? (
        <div className="aliyah-picker-list" role="listbox">
          {matches.length ? (
            matches.map((row, index) => (
              <div key={row.id}>
                {preferredHeading && preferredCount > 0 && index === 0 ? (
                  <p className="aliyah-picker-divider">{preferredHeading}</p>
                ) : null}
                {preferredHeading && preferredCount > 0 && index === preferredCount ? (
                  <p className="aliyah-picker-divider">שאר המתפללים</p>
                ) : null}
                <button
                  type="button"
                  className="aliyah-picker-item"
                  role="option"
                  aria-selected={row.id === selectedId}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(row.id);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {row.displayName}
                  {usedIds.has(row.id) && row.id !== selectedId ? " · כבר בעלייה אחרת" : ""}
                  <small>
                    {CONGREGANT_TRIBE_LABELS[row.tribe]}
                    {row.minyanId && row.minyanId !== minyanId && row.minyanName ? ` · ${row.minyanName}` : ""}
                    {row.prayerName ? ` · ${row.prayerName}` : ""}
                    {row.registrationStatus === "pending" ? " · ממתין לאישור" : ""}
                    {!row.receivesAliyah ? " · לא מסומן כעולה" : ""}
                  </small>
                </button>
              </div>
            ))
          ) : (
            <p className="aliyah-empty" style={{ padding: "0.45rem 0.65rem" }}>
              {showAll ? "אין התאמה ברשימת המתפללים" : "אין התאמה במניין הזה. סמנו «מכל המניינים» כדי לחפש בכולם."}
            </p>
          )}
          <button
            type="button"
            className="aliyah-picker-add"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onAddNew(query)}
          >
            הוספת מתפלל חדש{query.trim() ? ` — ${query.trim()}` : ""}
          </button>
        </div>
      ) : null}
      <button type="button" className="aliyah-add-link" onClick={() => onAddNew(query)}>
        העולה לא ברשימה — הוספת מתפלל
      </button>
    </div>
  );
}
