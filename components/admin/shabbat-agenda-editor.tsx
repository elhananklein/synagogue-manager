"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OCCASION_DAY_MAX,
  normalizeOccasionDay,
  type OccasionAgendaDayMeta,
  type OccasionDayIndex
} from "@/lib/sacred-occasion";
import type { ShabbatAgendaItemInput } from "@/lib/shabbat-agenda";

export type ShabbatAgendaItemModel = ShabbatAgendaItemInput & {
  localKey: string;
  occasionDay: OccasionDayIndex;
};

function newLocalKey() {
  return `sa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyItem(occasionDay: OccasionDayIndex = 1): ShabbatAgendaItemModel {
  return {
    localKey: newLocalKey(),
    sortOrder: 0,
    itemTime: "",
    content: "",
    published: true,
    occasionDay
  };
}

function dayMetaFallback(day: OccasionDayIndex): OccasionAgendaDayMeta {
  return {
    day,
    iso: "",
    title: day === 1 ? "יום א׳" : day === 2 ? "יום ב׳" : "יום ג׳",
    weekdayLabel: "",
    hebrewDate: "",
    weekdayChag: false,
    isChag: false,
    isSaturday: false,
    isLastDay: day === 1
  };
}

export function ShabbatAgendaEditor({
  items,
  onChange,
  parashaHint,
  occasionDays = [],
  className
}: {
  items: ShabbatAgendaItemModel[];
  onChange: (items: ShabbatAgendaItemModel[]) => void;
  parashaHint?: string | null;
  occasionDays?: OccasionAgendaDayMeta[];
  className?: string;
}) {
  const suggestedDays = Math.min(OCCASION_DAY_MAX, Math.max(1, occasionDays.length || 1));
  const maxFilled = Math.max(1, ...items.map((item) => normalizeOccasionDay(item.occasionDay)), 1);
  const [extraDays, setExtraDays] = useState(0);
  const baseDays = Math.max(suggestedDays, maxFilled);
  const visibleCount = Math.min(OCCASION_DAY_MAX, baseDays + extraDays);

  const blocks = useMemo(() => {
    return Array.from({ length: visibleCount }, (_, index) => {
      const day = normalizeOccasionDay(index + 1);
      const meta = occasionDays.find((item) => item.day === day) ?? dayMetaFallback(day);
      const rows = items
        .map((item, itemIndex) => ({ item, itemIndex }))
        .filter(({ item }) => normalizeOccasionDay(item.occasionDay) === day);
      return { day, meta, rows };
    });
  }, [items, occasionDays, visibleCount]);

  const updateItem = (localKey: string, patch: Partial<ShabbatAgendaItemModel>) => {
    onChange(items.map((item) => (item.localKey === localKey ? { ...item, ...patch } : item)));
  };

  const removeItem = (localKey: string) => {
    onChange(items.filter((item) => item.localKey !== localKey));
  };

  const moveItem = (localKey: string, direction: -1 | 1) => {
    const idx = items.findIndex((item) => item.localKey === localKey);
    if (idx < 0) return;
    const day = normalizeOccasionDay(items[idx]!.occasionDay);
    const sameDayIndexes = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => normalizeOccasionDay(item.occasionDay) === day)
      .map(({ index }) => index);
    const pos = sameDayIndexes.indexOf(idx);
    const swapWith = sameDayIndexes[pos + direction];
    if (swapWith == null) return;
    const copy = [...items];
    const tmp = copy[idx]!;
    copy[idx] = copy[swapWith]!;
    copy[swapWith] = tmp;
    onChange(copy);
  };

  const addItem = (day: OccasionDayIndex) => {
    onChange([...items, { ...createEmptyItem(day), sortOrder: items.length + 1 }]);
  };

  const copyFromPrevious = (day: OccasionDayIndex) => {
    if (day <= 1) return;
    const prevDay = normalizeOccasionDay(day - 1);
    const prev = items.filter((item) => normalizeOccasionDay(item.occasionDay) === prevDay);
    if (!prev.length) return;
    const existing = items.filter((item) => normalizeOccasionDay(item.occasionDay) === day);
    if (existing.length && !window.confirm("יש כבר שורות ביום הזה. להחליף אותן בהעתק מהיום הקודם?")) {
      return;
    }
    onChange([
      ...items.filter((item) => normalizeOccasionDay(item.occasionDay) !== day),
      ...prev.map((item) => ({
        ...createEmptyItem(day),
        itemTime: item.itemTime ?? "",
        content: item.content ?? "",
        published: item.published !== false
      }))
    ]);
  };

  const removeEmptyLastDay = () => {
    if (visibleCount <= suggestedDays && extraDays <= 0) return;
    const last = normalizeOccasionDay(visibleCount);
    if (items.some((item) => normalizeOccasionDay(item.occasionDay) === last)) return;
    setExtraDays((value) => Math.max(0, value - 1));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>לוח זמנים לשבתות וחגים</CardTitle>
        <p className="text-sm text-muted-foreground">
          סדר היום לשבת או לחג הקרוב
          {parashaHint ? (
            <>
              {" "}
              (<span className="font-medium text-foreground">{parashaHint}</span>)
            </>
          ) : null}
          . לכל שורה אפשר לכתוב מה קורה, וגם שעה אם רוצים. ערב היום הראשון (כמו ערב שבת) מוצג מתוך יום א׳ — אין
          בלוק נפרד לערב.
        </p>
        {suggestedDays > 1 ? (
          <p className="text-sm text-muted-foreground">
            למועד הזה מוצעים {suggestedDays} ימי שבתון ברצף. ממלאים כל יום בנפרד.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-8">
        {blocks.map(({ day, meta, rows }) => (
          <section key={day} className="space-y-4 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold">{meta.title || `יום ${day}`}</h3>
                <p className="text-sm text-muted-foreground">
                  {[meta.weekdayLabel, meta.hebrewDate].filter(Boolean).join(" · ") || `יום ${day} במועד`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {day > 1 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => copyFromPrevious(day)}>
                    העתק מהיום הקודם
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => addItem(day)}>
                  הוסף שורה
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
                אין שורות ליום הזה. ערב היום נכתב כאן, כמו בלוח שבת רגיל.
              </p>
            ) : null}

            {rows.map(({ item }, rowIndex) => (
              <div key={item.localKey} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">שורה {rowIndex + 1}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={rowIndex === 0}
                      onClick={() => moveItem(item.localKey, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={rowIndex === rows.length - 1}
                      onClick={() => moveItem(item.localKey, 1)}
                    >
                      ↓
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeItem(item.localKey)}>
                      מחק
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <div>
                    <label className="mb-1 block text-sm font-medium">שעה (אופציונלי)</label>
                    <input
                      type="time"
                      className="h-10 w-full rounded-md border border-border bg-background px-3"
                      value={item.itemTime ?? ""}
                      onChange={(e) => updateItem(item.localKey, { itemTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">תוכן</label>
                    <input
                      type="text"
                      className="h-10 w-full rounded-md border border-border bg-background px-3"
                      placeholder='למשל: שיר השירים / קריאת התורה ע"י… / קידוש לאחר התפילה'
                      value={item.content}
                      onChange={(e) => updateItem(item.localKey, { content: e.target.value })}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.published !== false}
                    onChange={(e) => updateItem(item.localKey, { published: e.target.checked })}
                  />
                  מוצג בתצוגה
                </label>
              </div>
            ))}
          </section>
        ))}

        <div className="flex flex-wrap gap-2">
          {visibleCount < OCCASION_DAY_MAX ? (
            <Button type="button" variant="outline" onClick={() => setExtraDays((value) => value + 1)}>
              הוספת יום
            </Button>
          ) : null}
          {visibleCount > baseDays &&
          !items.some((item) => normalizeOccasionDay(item.occasionDay) === normalizeOccasionDay(visibleCount)) ? (
            <Button type="button" variant="outline" onClick={removeEmptyLastDay}>
              הסרת יום ריק
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function mapShabbatAgendaFromApi(
  rows: Array<{
    id?: string;
    sortOrder: number;
    itemTime?: string | null;
    content?: string;
    published?: boolean;
    occasionDay?: number | null;
    localKey?: string;
  }>
): ShabbatAgendaItemModel[] {
  return rows.map((row, index) => {
    const id = row.id?.trim() || undefined;
    return {
      localKey: row.localKey || id || `sa-load-${index}-${Date.now()}`,
      id,
      sortOrder: row.sortOrder,
      itemTime: row.itemTime ?? "",
      content: row.content ?? "",
      published: row.published !== false,
      occasionDay: normalizeOccasionDay(row.occasionDay)
    };
  });
}

export function mapShabbatAgendaForSave(items: ShabbatAgendaItemModel[]): ShabbatAgendaItemInput[] {
  const byDay = new Map<OccasionDayIndex, ShabbatAgendaItemModel[]>();
  for (const item of items) {
    const day = normalizeOccasionDay(item.occasionDay);
    const list = byDay.get(day) ?? [];
    list.push(item);
    byDay.set(day, list);
  }
  const out: ShabbatAgendaItemInput[] = [];
  for (const day of [1, 2, 3] as const) {
    const list = (byDay.get(day) ?? []).filter((item) => item.content?.trim());
    list.forEach((item, index) => {
      out.push({
        id: item.id,
        sortOrder: index + 1,
        itemTime: item.itemTime?.trim() || null,
        content: item.content.trim(),
        published: item.published !== false,
        occasionDay: day
      });
    });
  }
  return out;
}
