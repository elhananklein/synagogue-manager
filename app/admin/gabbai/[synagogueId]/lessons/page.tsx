"use client";

import { use, useEffect, useState } from "react";
import {
  LessonsEditor,
  mapLessonsForSave,
  mapLessonsFromApi
} from "@/components/admin/lessons-editor";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { mapGabbaiSaveError, saveGabbaiSection } from "@/lib/gabbai-workspace";
import type { Lesson, LessonSeries } from "@/lib/lessons-types";

export default function GabbaiLessonsPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = use(params);
  const [series, setSeries] = useState<LessonSeries[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [showPrice, setShowPrice] = useState(false);
  const [showPriceReady, setShowPriceReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          synagogue?: { lessonsShowPrice?: boolean; lessonsShowPriceReady?: boolean };
          lessons?: { series?: LessonSeries[]; lessons?: Lesson[]; showPrice?: boolean };
        };
      };
      if (!payload.ok || !payload.data) {
        setLoadError("טעינת השיעורים נכשלה");
        return;
      }
      const mapped = mapLessonsFromApi(payload.data.lessons ?? {});
      setSeries(mapped.series);
      setLessons(mapped.lessons);
      setShowPriceReady(Boolean(payload.data.synagogue?.lessonsShowPriceReady));
      setShowPrice(
        Boolean(
          payload.data.synagogue?.lessonsShowPrice ??
            payload.data.lessons?.showPrice
        )
      );
    } catch {
      setLoadError("טעינת השיעורים נכשלה");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [synagogueId]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    if (series.some((s) => !s.name.trim())) {
      setSaving(false);
      setError("יש למלא שם לכל מסגרת");
      return;
    }
    if (lessons.some((l) => !l.startTime || (!l.lessonDate && l.weekday == null))) {
      setSaving(false);
      setError("לכל שיעור חובה שעה, ויום בשבוע או תאריך");
      return;
    }
    const payload = await saveGabbaiSection(synagogueId, {
      section: "lessons",
      ...mapLessonsForSave(series, lessons),
      ...(showPriceReady ? { lessonsShowPrice: showPrice } : {})
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("השיעורים נשמרו");
    await load();
  }

  if (isLoading) return <GabbaiLoadingPanel title="טוען את לוח השיעורים…" />;
  if (loadError) return <p className="gabbai-err">{loadError}</p>;

  return (
    <>
      <h1 className="gabbai-page-title">שיעורים</h1>
      <p className="gabbai-page-desc">
        לוח שיעורים לבית הכנסת: שיעורים בודדים או מסגרות (ערבי לימוד). מופיעים במובייל, בלוח הזמנים המלא על הקיר
        ובלוח השבת — לפי יום ושעה. מחיר מוצג רק במסך השיעורים, ורק אם סימנתם למטה. אחרי עריכה לחצו שמירה.
      </p>
      <div className="mb-4 rounded-xl border border-border bg-white p-3">
        {showPriceReady ? (
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => {
                setShowPrice(e.target.checked);
                setMessage(null);
              }}
            />
            להציג מחיר במסך השיעורים (לא בלוח הזמנים עם הקוביות)
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            כדי לבחור אם להציג מחיר, הריצו ב-Supabase את הקובץ supabase/lessons-show-price-migration.sql
          </p>
        )}
      </div>
      <LessonsEditor
        series={series}
        lessons={lessons}
        onChangeSeries={(next) => {
          setSeries(next);
          setMessage(null);
        }}
        onChangeLessons={(next) => {
          setLessons(next);
          setMessage(null);
        }}
      />
      <GabbaiSaveBar label="שמירת השיעורים" saving={saving} message={message} error={error} onSave={() => void save()} />
    </>
  );
}
