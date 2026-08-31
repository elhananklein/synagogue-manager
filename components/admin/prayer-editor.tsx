"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withParashaCatalogSelectKeys } from "@/lib/parasha-prayer-catalog";
import type { PrayerMode, PrayerSetting, PrayerType } from "@/lib/gabbai-types";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "א'" },
  { value: 1, label: "ב'" },
  { value: 2, label: "ג'" },
  { value: 3, label: "ד'" },
  { value: 4, label: "ה'" },
  { value: 5, label: "ו'" },
  { value: 6, label: "שבת" }
];

const ZMAN_ANCHORS = [
  { value: "sunrise", label: "זריחה" },
  { value: "sunset", label: "שקיעה" },
  { value: "chatzot", label: "חצות" },
  { value: "tzeit85deg", label: "צאת הכוכבים" }
];

export function PrayerEditor({
  setting,
  prayerOptions,
  onChange,
  onDelete,
  showDaysOfWeek = false,
  parashaCatalogKeys = []
}: {
  setting: PrayerSetting;
  prayerOptions: PrayerType[];
  onChange: (next: PrayerSetting) => void;
  onDelete: () => void;
  showDaysOfWeek?: boolean;
  parashaCatalogKeys?: string[];
}) {
  const currentOffset = setting.offsetMinutes ?? 0;
  const direction: "before" | "after" = currentOffset < 0 ? "before" : "after";
  const absoluteMinutes = Math.abs(currentOffset);
  const prayerLabel =
    setting.prayerType === "מנחה ערב שבת" ? "מנחה ערב שבת וקבלת שבת" : setting.prayerType;

  return (
    <div
      className={cn(
        "mb-3 rounded-xl p-3",
        setting.unsaved
          ? "border-2 border-dashed border-primary bg-primary/5 shadow-sm"
          : "border border-border bg-white"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{setting.unsaved ? "תפילה חדשה — עדיין לא נשמרה" : prayerLabel}</span>
        <Button type="button" variant="outline" size="sm" onClick={onDelete}>
          מחק
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[7rem] flex-1 sm:flex-none">
          <span className="mb-0.5 block text-xs text-muted-foreground">תפילה</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={setting.prayerType}
            onChange={(e) => {
              const prayerType = e.target.value as PrayerType;
              const canAnchorToMincha = prayerType === "ערבית" || prayerType === "ערבית מוצ'ש";
              onChange({
                ...setting,
                prayerType,
                lockToSunday:
                  prayerType === "מנחה" || prayerType === "ערבית" ? setting.lockToSunday : false,
                zmanAnchor:
                  setting.zmanAnchor === "mincha" && !canAnchorToMincha ? "sunset" : setting.zmanAnchor
              });
            }}
          >
            {prayerOptions.map((option) => (
              <option key={option} value={option}>
                {option === "מנחה ערב שבת" ? "מנחה ערב שבת וקבלת שבת" : option}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[9.5rem] flex-1 sm:flex-none">
          <span className="mb-0.5 block text-xs text-muted-foreground">איך קובעים את השעה?</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={setting.mode}
            onChange={(e) => {
              const mode = e.target.value as PrayerMode;
              if (!showDaysOfWeek && mode === "parasha") return;
              const next: PrayerSetting = { ...setting, mode };
              if (mode === "parasha") {
                next.zmanAnchor = null;
                next.offsetMinutes = 0;
                next.roundMode = "none";
                next.lockToSunday = false;
                if (setting.prayerType === "מנחה" || setting.prayerType === "ערבית") {
                  next.parashaKey = setting.parashaKey?.trim() ? setting.parashaKey : null;
                  next.fixedTime = setting.parashaKey?.trim() ? (setting.fixedTime ?? "12:00") : null;
                } else {
                  next.parashaKey = (setting.parashaKey?.trim() || parashaCatalogKeys[0] || "").trim() || null;
                  next.fixedTime = setting.fixedTime ?? "12:00";
                }
              } else if (mode === "fixed") {
                next.parashaKey = null;
                next.zmanAnchor = null;
                next.offsetMinutes = null;
                next.roundMode = "none";
                next.lockToSunday = false;
              } else {
                next.parashaKey = null;
                next.zmanAnchor = setting.zmanAnchor ?? "sunset";
                next.offsetMinutes = setting.offsetMinutes ?? 0;
                next.roundMode = setting.roundMode ?? "none";
              }
              onChange(next);
            }}
          >
            <option value="fixed">שעה קבועה</option>
            <option value="relative">לפי זריחה / שקיעה</option>
            {showDaysOfWeek ? <option value="parasha">לפי פרשת השבוע</option> : null}
          </select>
        </label>
        {setting.mode === "fixed" ? (
          <label>
            <span className="mb-0.5 block text-xs text-muted-foreground">שעה</span>
            <input
              type="time"
              className="h-11 rounded-md border border-border bg-background px-3"
              value={setting.fixedTime ?? ""}
              onChange={(e) => onChange({ ...setting, fixedTime: e.target.value })}
            />
          </label>
        ) : null}
        {setting.mode === "parasha" ? (
          <>
            <select
              className="h-11 min-w-[12rem] max-w-full flex-1 rounded-md border border-border bg-background px-2 text-sm"
              value={setting.parashaKey ?? ""}
              onChange={(e) => {
                const parashaKey = e.target.value || null;
                onChange({
                  ...setting,
                  parashaKey,
                  fixedTime: parashaKey ? (setting.fixedTime ?? "12:00") : null
                });
              }}
            >
              {setting.prayerType === "מנחה" || setting.prayerType === "ערבית" ? (
                <option value="">מהטבלה השנתית של הפרשות</option>
              ) : (
                <option value="">בחרו פרשה…</option>
              )}
              {withParashaCatalogSelectKeys(parashaCatalogKeys).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {setting.parashaKey ? (
              <input
                type="time"
                className="h-11 rounded-md border border-border bg-background px-3"
                value={setting.fixedTime ?? ""}
                onChange={(e) => onChange({ ...setting, fixedTime: e.target.value })}
              />
            ) : null}
          </>
        ) : null}
        {setting.mode === "relative" ? (
          <>
            <select
              className="h-11 min-w-[8rem] rounded-md border border-border bg-background px-3"
              value={setting.zmanAnchor ?? "sunset"}
              onChange={(e) => onChange({ ...setting, zmanAnchor: e.target.value })}
            >
              {(setting.prayerType === "ערבית" || setting.prayerType === "ערבית מוצ'ש"
                ? [...ZMAN_ANCHORS, { value: "mincha", label: "תפילת מנחה" }]
                : ZMAN_ANCHORS
              ).map((anchor) => (
                <option key={anchor.value} value={anchor.value}>
                  {anchor.label}
                </option>
              ))}
            </select>
            <select
              className="h-11 min-w-[5rem] rounded-md border border-border bg-background px-3"
              value={direction}
              onChange={(e) =>
                onChange({
                  ...setting,
                  offsetMinutes: e.target.value === "before" ? -absoluteMinutes : absoluteMinutes
                })
              }
            >
              <option value="before">לפני</option>
              <option value="after">אחרי</option>
            </select>
            <input
              type="number"
              min={0}
              className="h-11 w-20 rounded-md border border-border bg-background px-3"
              value={absoluteMinutes}
              onChange={(e) =>
                onChange({
                  ...setting,
                  offsetMinutes: direction === "before" ? -Number(e.target.value) : Number(e.target.value)
                })
              }
              placeholder="דקות"
              aria-label="דקות"
            />
            <select
              className="h-11 min-w-[7rem] rounded-md border border-border bg-background px-2 text-sm"
              value={setting.roundMode ?? "none"}
              onChange={(e) =>
                onChange({
                  ...setting,
                  roundMode: e.target.value as "none" | "up" | "down"
                })
              }
            >
              <option value="none">בלי עיגול</option>
              <option value="up">עיגול למעלה (5 דק׳)</option>
              <option value="down">עיגול למטה (5 דק׳)</option>
            </select>
          </>
        ) : null}
      </div>
      {setting.mode === "relative" && setting.zmanAnchor === "mincha" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          השעה תחושב לפי מנחה של אותו יום. אם אין מנחה — ערבית לא תוצג.
        </p>
      ) : null}
      {showDaysOfWeek &&
      setting.mode === "relative" &&
      (setting.prayerType === "מנחה" || setting.prayerType === "ערבית") ? (
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={Boolean(setting.lockToSunday)}
            onChange={(e) => onChange({ ...setting, lockToSunday: e.target.checked })}
          />
          <span>אותה שעה כל השבוע, לפי יום ראשון</span>
        </label>
      ) : null}
      {showDaysOfWeek && setting.mode === "parasha" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          בימים א׳–ה׳ בלבד. שישי ושבת נשארים לפי ההגדרה הרגילה.
        </p>
      ) : null}
      {showDaysOfWeek ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((day) => (
            <label key={day.value} className="inline-flex min-h-10 items-center gap-1 rounded-md border px-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={setting.daysOfWeek.includes(day.value)}
                onChange={(e) =>
                  onChange({
                    ...setting,
                    daysOfWeek: e.target.checked
                      ? [...setting.daysOfWeek, day.value]
                      : setting.daysOfWeek.filter((d) => d !== day.value)
                  })
                }
              />
              {day.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
