"use client";

import { use } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiMinyanSwitch } from "@/components/admin/gabbai-minyan-switch";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import {
  DISPLAY_FONTS,
  resolveDisplayFont
} from "@/lib/display-font";
import {
  DISPLAY_PALETTES,
  DISPLAY_STYLE_LABELS,
  DISPLAY_STYLES,
  resolveDisplayPalette,
  styleUsesPalettes,
  type DisplayPalette,
  type DisplayStyle
} from "@/lib/display-theme";
import { HAFTARAH_MINHAGIM, HAFTARAH_MINHAG_LABELS, type HaftarahMinhag } from "@/lib/haftarah-minhag";
import { ZMANIM_CATALOG } from "@/lib/zmanim-catalog";
import type { ScreenKey, ScreenSetting } from "@/lib/gabbai-types";
import { mapGabbaiSaveError, saveGabbaiSection, useGabbaiWorkspace, type GabbaiMinyan } from "@/lib/gabbai-workspace";

const SCREEN_OPTIONS: Array<{ key: ScreenKey; label: string }> = [
  { key: "main", label: "מסך ראשי" },
  { key: "mainInfo", label: "מידע מרכזי (מוגדל)" },
  { key: "clock", label: "שעון" },
  { key: "omer", label: "ספירת העומר" },
  { key: "halacha", label: "הלכה יומית" },
  { key: "dailyLearning", label: "לימוד יומי" },
  { key: "prayerTimes", label: "זמני תפילות" },
  { key: "fullSchedule", label: "לוח זמנים מלא" },
  { key: "shabbat", label: "שבת" },
  { key: "bulletin", label: "לוח מודעות" }
];

function nextAvailableScreenKey(screens: ScreenSetting[]): ScreenKey | null {
  const used = new Set(screens.map((s) => s.screenKey));
  return SCREEN_OPTIONS.find((o) => !used.has(o.key))?.key ?? null;
}

function renumberScreens(screens: ScreenSetting[]): ScreenSetting[] {
  return screens.map((screen, index) => ({ ...screen, sortOrder: index + 1 }));
}

function moveScreen(screens: ScreenSetting[], index: number, direction: -1 | 1): ScreenSetting[] {
  const next = index + direction;
  if (next < 0 || next >= screens.length) return screens;
  const copy = [...screens];
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  return renumberScreens(copy);
}

export default function GabbaiLookPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = use(params);
  const { minyanim, setMinyanim, isLoading, error: loadError, reload } = useGabbaiWorkspace(synagogueId);
  const [minyanIndex, setMinyanIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minyan = minyanim[minyanIndex] ?? minyanim[0];

  function update(patch: Partial<GabbaiMinyan> | ((m: GabbaiMinyan) => GabbaiMinyan)) {
    setMinyanim((prev) =>
      prev.map((m, i) => {
        if (i !== minyanIndex) return m;
        return typeof patch === "function" ? patch(m) : { ...m, ...patch };
      })
    );
    setMessage(null);
  }

  async function save() {
    if (!minyan?.id) {
      setError("שמרו קודם את המניין בהגדרות בית הכנסת.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "look",
      minyanId: minyan.id,
      displayStyle: minyan.displayStyle,
      displayPalette: minyan.displayPalette,
      displayFont: minyan.displayFont,
      haftarahMinhag: minyan.haftarahMinhag,
      scheduleTimesListMode: minyan.scheduleTimesListMode,
      scheduleZmanimKeys: minyan.scheduleZmanimKeys,
      footerText: minyan.footerText,
      screens: minyan.screens
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("מראה המסך נשמר");
    await reload();
  }

  if (isLoading) return <GabbaiLoadingPanel title="טוען את מראה המסך…" />;
  if (loadError) return <p className="gabbai-err">{loadError}</p>;
  if (!minyan) return <p className="gabbai-hint">אין מניין. הוסיפו מניין בהגדרות בית הכנסת.</p>;

  return (
    <>
      <h1 className="gabbai-page-title">מראה המסך</h1>
      <p className="gabbai-page-desc">איך המסך נראה על הקיר: סגנון, צבעים, פונט, ואילו מסכים מתחלפים.</p>
      <GabbaiMinyanSwitch
        names={minyanim.map((m) => m.name)}
        index={Math.min(minyanIndex, minyanim.length - 1)}
        onChange={setMinyanIndex}
      />

      <div className="mb-4">
        <a
          className="inline-flex h-11 items-center rounded-md border border-border bg-background px-3 text-sm font-semibold"
          href={`/display?synagogueId=${encodeURIComponent(synagogueId)}&minyan=${minyanIndex + 1}`}
        >
          צפייה במסך
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm font-medium">סגנון</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={minyan.displayStyle}
            onChange={(e) => {
              const displayStyle = e.target.value as DisplayStyle;
              update({
                displayStyle,
                displayPalette: styleUsesPalettes(displayStyle)
                  ? resolveDisplayPalette(displayStyle, minyan.displayPalette)
                  : minyan.displayPalette
              });
            }}
          >
            {DISPLAY_STYLES.map((style) => (
              <option key={style} value={style}>
                {DISPLAY_STYLE_LABELS[style]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium">פונט</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={minyan.displayFont}
            onChange={(e) => update({ displayFont: resolveDisplayFont(e.target.value) })}
          >
            {DISPLAY_FONTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {styleUsesPalettes(minyan.displayStyle) ? (
          <label>
            <span className="mb-1 block text-sm font-medium">צבעים</span>
            <select
              className="h-11 w-full rounded-md border border-border bg-background px-3"
              value={minyan.displayPalette}
              onChange={(e) => update({ displayPalette: e.target.value as DisplayPalette })}
            >
              {DISPLAY_PALETTES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span className="mb-1 block text-sm font-medium">מנהג הפטרה</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={minyan.haftarahMinhag}
            onChange={(e) => update({ haftarahMinhag: e.target.value as HaftarahMinhag })}
          >
            {HAFTARAH_MINHAGIM.map((minhag) => (
              <option key={minhag} value={minhag}>
                {HAFTARAH_MINHAG_LABELS[minhag]}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">הודעה בתחתית המסך</span>
          <input
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={minyan.footerText}
            maxLength={120}
            placeholder="לדוגמה: ברוכים הבאים"
            onChange={(e) => update({ footerText: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-8">
        <h2 className="mb-1 text-base font-extrabold">מה מוצג במסך הראשי</h2>
        <p className="mb-3 text-sm text-muted-foreground">רק תפילות, או גם זמני היום (זריחה, שקיעה וכו׳).</p>
        <select
          className="h-11 w-full max-w-md rounded-md border border-border bg-background px-3"
          value={minyan.scheduleTimesListMode}
          onChange={(e) =>
            update({ scheduleTimesListMode: e.target.value === "prayers_only" ? "prayers_only" : "all" })
          }
        >
          <option value="all">תפילות וגם זמני היום</option>
          <option value="prayers_only">רק זמני תפילות</option>
        </select>
        {minyan.scheduleTimesListMode !== "prayers_only" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ZMANIM_CATALOG.map((zman) => {
              const checked = minyan.scheduleZmanimKeys.includes(zman.key);
              return (
                <label key={zman.key} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      update({
                        scheduleZmanimKeys: e.target.checked
                          ? [...minyan.scheduleZmanimKeys, zman.key]
                          : minyan.scheduleZmanimKeys.filter((k) => k !== zman.key)
                      })
                    }
                  />
                  {zman.label}
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold">מסכים מתחלפים</h2>
            <p className="text-sm text-muted-foreground">מה יופיע על הקיר, ובאיזה סדר. החצים משנים סדר.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!nextAvailableScreenKey(minyan.screens)}
            onClick={() => {
              const key = nextAvailableScreenKey(minyan.screens);
              if (!key) return;
              update((m) => ({
                ...m,
                screens: [
                  ...m.screens,
                  { screenKey: key, sortOrder: m.screens.length + 1, durationSeconds: 20, enabled: true }
                ]
              }));
            }}
          >
            הוספת מסך
          </Button>
        </div>
        <div className="space-y-2">
          {minyan.screens.map((screen, screenIndex) => (
            <div key={`${screen.screenKey}-${screenIndex}`} className="space-y-2 rounded-xl border border-border bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">מסך {screenIndex + 1}</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={screenIndex === 0}
                    onClick={() => update((m) => ({ ...m, screens: moveScreen(m.screens, screenIndex, -1) }))}
                  >
                    למעלה
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={screenIndex === minyan.screens.length - 1}
                    onClick={() => update((m) => ({ ...m, screens: moveScreen(m.screens, screenIndex, 1) }))}
                  >
                    למטה
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update((m) => ({
                        ...m,
                        screens: renumberScreens(m.screens.filter((_, j) => j !== screenIndex))
                      }))
                    }
                  >
                    הסרה
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_auto_5.5rem]">
                <select
                  className="h-11 w-full rounded-md border border-border bg-background px-3"
                  value={screen.screenKey}
                  onChange={(e) => {
                    const nextKey = e.target.value as ScreenKey;
                    update((m) => ({
                      ...m,
                      screens: m.screens.map((s, j) => (j === screenIndex ? { ...s, screenKey: nextKey } : s))
                    }));
                  }}
                >
                  {SCREEN_OPTIONS.map((opt) => {
                    const takenByOther = minyan.screens.some((s, j) => j !== screenIndex && s.screenKey === opt.key);
                    return (
                      <option key={opt.key} value={opt.key} disabled={takenByOther}>
                        {opt.label}
                      </option>
                    );
                  })}
                </select>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={screen.enabled}
                    onChange={(e) =>
                      update((m) => ({
                        ...m,
                        screens: m.screens.map((s, j) =>
                          j === screenIndex ? { ...s, enabled: e.target.checked } : s
                        )
                      }))
                    }
                  />
                  מוצג
                </label>
                <label>
                  <span className="mb-0.5 block text-[11px] text-muted-foreground">שניות</span>
                  <input
                    type="number"
                    className="h-11 w-full rounded-md border border-border bg-background px-2"
                    value={screen.durationSeconds}
                    onChange={(e) =>
                      update((m) => ({
                        ...m,
                        screens: m.screens.map((s, j) =>
                          j === screenIndex ? { ...s, durationSeconds: Number(e.target.value) } : s
                        )
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <GabbaiSaveBar label="שמירת מראה המסך" saving={saving} message={message} error={error} onSave={() => void save()} />
    </>
  );
}
