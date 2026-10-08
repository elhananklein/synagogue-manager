"use client";

import { use } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { SynagogueLogoField } from "@/components/admin/synagogue-logo-field";
import { isLiveHalachaSource } from "@/lib/halacha-source";
import {
  mapGabbaiSaveError,
  saveGabbaiSection,
  useGabbaiWorkspace,
  type HalachaSettingsModel
} from "@/lib/gabbai-workspace";
import { HAFTARAH_MINHAGIM, PRAYER_NUSACH_LABELS, type HaftarahMinhag } from "@/lib/haftarah-minhag";
import {
  ALIYAH_MESSAGE_PLACEHOLDERS,
  ALIYAH_MESSAGE_TEMPLATE_MAX,
  DEFAULT_ALIYAH_MESSAGE_TEMPLATE,
  renderAliyahMessage
} from "@/lib/aliyah-message";

export default function GabbaiSettingsPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = use(params);
  const {
    synagogueName,
    setSynagogueName,
    logoUrl,
    setLogoUrl,
    logoUpdatedAt,
    setLogoUpdatedAt,
    donationUrl,
    setDonationUrl,
    aliyahMessageTemplate,
    setAliyahMessageTemplate,
    messagingReady,
    minyanDonationReady,
    minyanim,
    setMinyanim,
    halachaSettings,
    setHalachaSettings,
    isLoading,
    error: loadError,
    reload
  } = useGabbaiWorkspace(synagogueId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const messageTemplate = aliyahMessageTemplate;

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "settings",
      synagogueName,
      ...(messagingReady ? { donationUrl, aliyahMessageTemplate: messageTemplate } : {}),
      halachaSettings,
      minyanNames: minyanim
        .filter((m) => m.id)
        .map((m) => ({
          id: m.id as string,
          name: m.name,
          haftarahMinhag: m.haftarahMinhag,
          ...(minyanDonationReady ? { donationUrl: m.donationUrl } : {})
        }))
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("ההגדרות נשמרו");
    await reload();
  }

  async function addMinyan() {
    setSaving(true);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "minyan-create",
      minyanName: "מניין חדש"
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    await reload();
    setMessage("נוסף מניין חדש — אפשר לשנות את שמו ולשמור");
  }

  async function deleteMinyan(id: string) {
    setSaving(true);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "minyan-delete",
      minyanId: id
    });
    setPendingDeleteId(null);
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("המניין נמחק");
    await reload();
  }

  if (isLoading) return <GabbaiLoadingPanel title="טוען הגדרות…" />;
  if (loadError) return <p className="gabbai-err">{loadError}</p>;

  const liveHalacha = isLiveHalachaSource(halachaSettings.sourceKey);

  return (
    <>
      <h1 className="gabbai-page-title">הגדרות בית הכנסת</h1>
      <p className="gabbai-page-desc">שם בית הכנסת, לוגו, המניינים ונוסח התפילה, ומאיפה מגיעה ההלכה היומית.</p>

      <label className="mb-6 block">
        <span className="mb-1 block text-sm font-medium">שם בית הכנסת</span>
        <input
          className="h-11 w-full rounded-md border border-border bg-background px-3"
          value={synagogueName}
          onChange={(e) => {
            setSynagogueName(e.target.value);
            setMessage(null);
          }}
        />
      </label>

      <SynagogueLogoField
        synagogueId={synagogueId}
        logoUrl={logoUrl}
        logoUpdatedAt={logoUpdatedAt}
        onChanged={({ logoUrl: nextUrl, logoUpdatedAt: nextAt }) => {
          setLogoUrl(nextUrl);
          setLogoUpdatedAt(nextAt);
        }}
      />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">מניינים</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void addMinyan()} disabled={saving}>
            הוספת מניין
          </Button>
        </div>
        <div className="space-y-2">
          {minyanim.map((m, i) => (
            <div key={m.id ?? `new-${i}`} className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-white p-3">
              <label className="min-w-[8rem] flex-1">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">שם המניין</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-background px-3"
                  value={m.name}
                  placeholder={`מניין ${i + 1}`}
                  onChange={(e) => {
                    setMinyanim((prev) => prev.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)));
                    setMessage(null);
                  }}
                />
              </label>
              <label className="w-full sm:w-44">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">נוסח התפילה</span>
                <select
                  className="h-11 w-full rounded-md border border-border bg-background px-3"
                  value={m.haftarahMinhag}
                  onChange={(e) => {
                    const haftarahMinhag = e.target.value as HaftarahMinhag;
                    setMinyanim((prev) => prev.map((row, j) => (j === i ? { ...row, haftarahMinhag } : row)));
                    setMessage(null);
                  }}
                >
                  {HAFTARAH_MINHAGIM.map((nusach) => (
                    <option key={nusach} value={nusach}>
                      {PRAYER_NUSACH_LABELS[nusach]}
                    </option>
                  ))}
                </select>
              </label>
              {m.id && minyanim.length > 1 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setPendingDeleteId(m.id ?? null)}>
                  מחיקה
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          נוסח המניין קובע את ההפטרה במסך השבת ואת ברכת השנים על הקיר. לא משנים את זה במראה המסך.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-base font-extrabold">הלכה יומית</h2>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">מאיפה מגיעה ההלכה?</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={
              halachaSettings.sourceKey === "yalkut_yosef" ? "sefaria_halacha_yomit" : halachaSettings.sourceKey
            }
            onChange={(e) =>
              setHalachaSettings((prev) => ({
                ...prev,
                sourceKey: e.target.value as HalachaSettingsModel["sourceKey"]
              }))
            }
          >
            <option value="sefaria_halacha_yomit">הלכה יומית משולחן ערוך</option>
            <option value="kitzur_shulchan_arukh">קיצור שולחן ערוך</option>
            <option value="manual">הלכות שהוזנו ידנית</option>
          </select>
        </label>
        {liveHalacha ? (
          <p className="text-sm text-muted-foreground">כל יום תוצג הלכת היום. אם אין רשת — תוצג הלכת אתמול, לא מסך ריק.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">תאריך התחלה</span>
              <input
                type="date"
                className="h-11 w-full rounded-md border border-border bg-background px-3"
                value={halachaSettings.startDate}
                onChange={(e) => setHalachaSettings((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">אופן תצוגה</span>
              <select
                className="h-11 w-full rounded-md border border-border bg-background px-3"
                value={halachaSettings.displayMode}
                onChange={(e) =>
                  setHalachaSettings((prev) => ({
                    ...prev,
                    displayMode: e.target.value as "summary" | "full"
                  }))
                }
              >
                <option value="summary">תקציר</option>
                <option value="full">מלא</option>
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-extrabold">הודעות לעולים</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          בגיליון העליות יופיע כפתור «שליחה בוואטסאפ» ליד כל עולה שאישר לקבל הודעות. ההודעה נשלחת מהוואטסאפ שלכם.
        </p>
        {!messagingReady ? (
          <p className="gabbai-err mb-3">
            חסרים שדות במסד. הריצו ב-Supabase את הקובץ supabase/aliyah-messages-migration.sql ורעננו.
          </p>
        ) : null}
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">קישור כללי לתרומה (JGive או אחר)</span>
          <input
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            dir="ltr"
            type="url"
            inputMode="url"
            placeholder="https://www.jgive.com/..."
            value={donationUrl}
            disabled={!messagingReady}
            onChange={(e) => {
              setDonationUrl(e.target.value);
              setMessage(null);
            }}
          />
        </label>
        <div className="mb-4 rounded-xl border border-border bg-white p-3">
          <p className="mb-2 text-sm font-medium">קישור נפרד למניין (לא חובה)</p>
          <p className="mb-2 text-xs text-muted-foreground">
            מניין עם קישור משלו — ההודעות לעולים שלו ישתמשו בקישור הזה. ריק — הקישור הכללי.
          </p>
          {!minyanDonationReady ? (
            <p className="gabbai-err mb-2 text-sm">
              חסר שדה במסד. הריצו ב-Supabase את הקובץ supabase/minyan-donation-url-migration.sql ורעננו.
            </p>
          ) : null}
          <div className="space-y-2">
            {minyanim
              .filter((m) => m.id)
              .map((m, i) => (
                <label key={m.id} className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">{m.name || `מניין ${i + 1}`}</span>
                  <input
                    className="h-11 w-full rounded-md border border-border bg-background px-3"
                    dir="ltr"
                    type="url"
                    inputMode="url"
                    placeholder={donationUrl.trim() || "https://..."}
                    value={m.donationUrl}
                    disabled={!minyanDonationReady}
                    onChange={(e) => {
                      const next = e.target.value;
                      setMinyanim((prev) => prev.map((row) => (row.id === m.id ? { ...row, donationUrl: next } : row)));
                      setMessage(null);
                    }}
                  />
                </label>
              ))}
          </div>
        </div>
        <label className="mb-2 block">
          <span className="mb-1 block text-sm font-medium">נוסח ההודעה</span>
          <textarea
            className="min-h-[9rem] w-full rounded-md border border-border bg-background p-3 leading-relaxed"
            maxLength={ALIYAH_MESSAGE_TEMPLATE_MAX}
            value={messageTemplate}
            disabled={!messagingReady}
            onChange={(e) => {
              setAliyahMessageTemplate(e.target.value);
              setMessage(null);
            }}
          />
        </label>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!messagingReady || messageTemplate === DEFAULT_ALIYAH_MESSAGE_TEMPLATE}
            onClick={() => {
              setAliyahMessageTemplate(DEFAULT_ALIYAH_MESSAGE_TEMPLATE);
              setMessage(null);
            }}
          >
            חזרה לנוסח המקורי
          </Button>
        </div>
        <ul className="mb-3 space-y-1 text-xs text-muted-foreground">
          {ALIYAH_MESSAGE_PLACEHOLDERS.map((item) => (
            <li key={item.token}>
              <code className="font-bold text-foreground">{item.token}</code> — {item.label}
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-border bg-white p-3">
          <p className="mb-1 text-xs font-bold text-muted-foreground">כך תיראה ההודעה (דוגמה)</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {renderAliyahMessage(messageTemplate, {
              firstName: "משה",
              kind: "shabbat",
              parashaLabel: "נח",
              weekday: "שבת",
              hebrewDate: "",
              synagogueName,
              donationUrl: donationUrl.trim() || "(קישור התרומה)",
              optOutUrl: "(קישור אישי להסרה)"
            })}
          </p>
        </div>
      </section>

      <GabbaiSaveBar label="שמירת ההגדרות" saving={saving} message={message} error={error} onSave={() => void save()} />

      {pendingDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold">למחוק את המניין?</h3>
            <p className="mt-2 text-sm text-muted-foreground">המניין וזמני התפילה שלו יימחקו. לא ניתן לבטל.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingDeleteId(null)}>
                ביטול
              </Button>
              <Button type="button" onClick={() => void deleteMinyan(pendingDeleteId)}>
                כן, למחוק
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
