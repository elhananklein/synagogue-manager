"use client";

import { Button } from "@/components/ui/button";
import type { Lesson, LessonSeries } from "@/lib/lessons-types";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "ראשון" },
  { value: 1, label: "שני" },
  { value: 2, label: "שלישי" },
  { value: 3, label: "רביעי" },
  { value: 4, label: "חמישי" },
  { value: 5, label: "שישי" },
  { value: 6, label: "שבת" }
];

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptySeries(): LessonSeries {
  return {
    id: newId(),
    name: "",
    audience: null,
    price: null,
    displayAsGroup: false,
    published: true,
    sortOrder: 0
  };
}

export function createEmptyLesson(): Lesson {
  return {
    id: newId(),
    seriesId: null,
    weekday: 0,
    lessonDate: null,
    startTime: "18:00",
    topic: null,
    speaker: null,
    audience: null,
    price: null,
    published: true,
    sortOrder: 0
  };
}

export function mapLessonsFromApi(payload: {
  series?: LessonSeries[];
  lessons?: Lesson[];
}): { series: LessonSeries[]; lessons: Lesson[] } {
  return {
    series: Array.isArray(payload.series) ? payload.series.map((s) => ({ ...s, id: s.id || newId() })) : [],
    lessons: Array.isArray(payload.lessons)
      ? payload.lessons.map((l) => ({
          ...l,
          id: l.id || newId(),
          startTime: l.startTime?.slice(0, 5) || "18:00"
        }))
      : []
  };
}

export function mapLessonsForSave(series: LessonSeries[], lessons: Lesson[]) {
  return {
    series: series.map((s, i) => ({
      id: s.id,
      name: s.name,
      audience: s.audience,
      price: s.price,
      displayAsGroup: s.displayAsGroup,
      published: s.published,
      sortOrder: i + 1
    })),
    lessons: lessons.map((l, i) => ({
      id: l.id,
      seriesId: l.seriesId,
      weekday: l.lessonDate ? null : l.weekday,
      lessonDate: l.lessonDate,
      startTime: l.startTime,
      topic: l.topic,
      speaker: l.speaker,
      audience: l.seriesId ? null : l.audience,
      price: l.seriesId ? null : l.price,
      published: l.published,
      sortOrder: i + 1
    }))
  };
}

export function LessonsEditor({
  series,
  lessons,
  onChangeSeries,
  onChangeLessons
}: {
  series: LessonSeries[];
  lessons: Lesson[];
  onChangeSeries: (next: LessonSeries[]) => void;
  onChangeLessons: (next: Lesson[]) => void;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold">מסגרות / ערבי לימוד</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              מקבץ שיעורים עם מחיר וקהל משותפים. «הצג כאחד» = פריט אחד בלוח בשעת השיעור הראשון.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChangeSeries([...series, createEmptySeries()])}>
            הוספת מסגרת
          </Button>
        </div>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין מסגרות. אפשר להוסיף שיעורים בודדים בלי מסגרת.</p>
        ) : (
          series.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-xl border border-border bg-white p-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-0.5 block text-xs text-muted-foreground">שם המסגרת</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-background px-3"
                  value={row.name}
                  onChange={(e) =>
                    onChangeSeries(series.map((s) => (s.id === row.id ? { ...s, name: e.target.value } : s)))
                  }
                  placeholder="ערב לימוד נשים"
                />
              </label>
              <label>
                <span className="mb-0.5 block text-xs text-muted-foreground">למי מיועד</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-background px-3"
                  value={row.audience ?? ""}
                  onChange={(e) =>
                    onChangeSeries(
                      series.map((s) => (s.id === row.id ? { ...s, audience: e.target.value || null } : s))
                    )
                  }
                  placeholder="נשים / גברים…"
                />
              </label>
              <label>
                <span className="mb-0.5 block text-xs text-muted-foreground">מחיר</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-background px-3"
                  value={row.price ?? ""}
                  onChange={(e) =>
                    onChangeSeries(series.map((s) => (s.id === row.id ? { ...s, price: e.target.value || null } : s)))
                  }
                  placeholder="120 ₪ לחודש"
                />
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.displayAsGroup}
                  onChange={(e) =>
                    onChangeSeries(
                      series.map((s) => (s.id === row.id ? { ...s, displayAsGroup: e.target.checked } : s))
                    )
                  }
                />
                הצג את כל המסגרת כאחד בלוח
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.published}
                  onChange={(e) =>
                    onChangeSeries(series.map((s) => (s.id === row.id ? { ...s, published: e.target.checked } : s)))
                  }
                />
                מוצג לציבור
              </label>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onChangeSeries(series.filter((s) => s.id !== row.id));
                    onChangeLessons(lessons.map((l) => (l.seriesId === row.id ? { ...l, seriesId: null } : l)));
                  }}
                >
                  מחק מסגרת
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold">שיעורים</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              יום בשבוע או תאריך חד־פעמי (לא שניהם). בלי נושא יוצג «שיעור». שעה חובה.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChangeLessons([...lessons, createEmptyLesson()])}>
            הוספת שיעור
          </Button>
        </div>
        {lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין שיעורים עדיין.</p>
        ) : (
          lessons.map((row) => {
            const scheduleMode = row.lessonDate ? "date" : "weekday";
            return (
              <div key={row.id} className="grid gap-2 rounded-xl border border-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
                <label>
                  <span className="mb-0.5 block text-xs text-muted-foreground">סוג תזמון</span>
                  <select
                    className="h-11 w-full rounded-md border border-border bg-background px-3"
                    value={scheduleMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      onChangeLessons(
                        lessons.map((l) =>
                          l.id === row.id
                            ? mode === "date"
                              ? {
                                  ...l,
                                  weekday: null,
                                  lessonDate: l.lessonDate || new Date().toISOString().slice(0, 10)
                                }
                              : { ...l, lessonDate: null, weekday: l.weekday ?? 0 }
                            : l
                        )
                      );
                    }}
                  >
                    <option value="weekday">חוזר — יום בשבוע</option>
                    <option value="date">חד־פעמי — תאריך</option>
                  </select>
                </label>
                {scheduleMode === "weekday" ? (
                  <label>
                    <span className="mb-0.5 block text-xs text-muted-foreground">יום</span>
                    <select
                      className="h-11 w-full rounded-md border border-border bg-background px-3"
                      value={row.weekday ?? 0}
                      onChange={(e) =>
                        onChangeLessons(
                          lessons.map((l) =>
                            l.id === row.id ? { ...l, weekday: Number(e.target.value), lessonDate: null } : l
                          )
                        )
                      }
                    >
                      {WEEKDAY_OPTIONS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    <span className="mb-0.5 block text-xs text-muted-foreground">תאריך</span>
                    <input
                      type="date"
                      className="h-11 w-full rounded-md border border-border bg-background px-3"
                      value={row.lessonDate ?? ""}
                      onChange={(e) =>
                        onChangeLessons(
                          lessons.map((l) =>
                            l.id === row.id ? { ...l, lessonDate: e.target.value || null, weekday: null } : l
                          )
                        )
                      }
                    />
                  </label>
                )}
                <label>
                  <span className="mb-0.5 block text-xs text-muted-foreground">שעה</span>
                  <input
                    type="time"
                    className="h-11 w-full rounded-md border border-border bg-background px-3"
                    value={row.startTime}
                    onChange={(e) =>
                      onChangeLessons(lessons.map((l) => (l.id === row.id ? { ...l, startTime: e.target.value } : l)))
                    }
                  />
                </label>
                <label>
                  <span className="mb-0.5 block text-xs text-muted-foreground">נושא</span>
                  <input
                    className="h-11 w-full rounded-md border border-border bg-background px-3"
                    value={row.topic ?? ""}
                    onChange={(e) =>
                      onChangeLessons(
                        lessons.map((l) => (l.id === row.id ? { ...l, topic: e.target.value || null } : l))
                      )
                    }
                    placeholder="גמרא / תנ״ך… (ריק = שיעור)"
                  />
                </label>
                <label>
                  <span className="mb-0.5 block text-xs text-muted-foreground">מרצה</span>
                  <input
                    className="h-11 w-full rounded-md border border-border bg-background px-3"
                    value={row.speaker ?? ""}
                    onChange={(e) =>
                      onChangeLessons(
                        lessons.map((l) => (l.id === row.id ? { ...l, speaker: e.target.value || null } : l))
                      )
                    }
                  />
                </label>
                <label>
                  <span className="mb-0.5 block text-xs text-muted-foreground">מסגרת</span>
                  <select
                    className="h-11 w-full rounded-md border border-border bg-background px-3"
                    value={row.seriesId ?? ""}
                    onChange={(e) =>
                      onChangeLessons(
                        lessons.map((l) =>
                          l.id === row.id ? { ...l, seriesId: e.target.value || null, audience: null, price: null } : l
                        )
                      )
                    }
                  >
                    <option value="">ללא מסגרת</option>
                    {series.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name.trim() || "מסגרת ללא שם"}
                      </option>
                    ))}
                  </select>
                </label>
                {!row.seriesId ? (
                  <>
                    <label>
                      <span className="mb-0.5 block text-xs text-muted-foreground">למי מיועד</span>
                      <input
                        className="h-11 w-full rounded-md border border-border bg-background px-3"
                        value={row.audience ?? ""}
                        onChange={(e) =>
                          onChangeLessons(
                            lessons.map((l) => (l.id === row.id ? { ...l, audience: e.target.value || null } : l))
                          )
                        }
                      />
                    </label>
                    <label>
                      <span className="mb-0.5 block text-xs text-muted-foreground">מחיר</span>
                      <input
                        className="h-11 w-full rounded-md border border-border bg-background px-3"
                        value={row.price ?? ""}
                        onChange={(e) =>
                          onChangeLessons(
                            lessons.map((l) => (l.id === row.id ? { ...l, price: e.target.value || null } : l))
                          )
                        }
                      />
                    </label>
                  </>
                ) : null}
                <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.published}
                    onChange={(e) =>
                      onChangeLessons(
                        lessons.map((l) => (l.id === row.id ? { ...l, published: e.target.checked } : l))
                      )
                    }
                  />
                  מוצג לציבור
                </label>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChangeLessons(lessons.filter((l) => l.id !== row.id))}
                  >
                    מחק
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
