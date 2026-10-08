"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CongregantThemeFrame } from "@/components/admin/congregant-theme-frame";
import { CongregantQuickAddDialog } from "@/components/admin/congregant-quick-add-dialog";
import { AliyahCongregantPicker, preferredTribeForSlot } from "@/components/admin/aliyah-congregant-picker";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiMinyanSwitch } from "@/components/admin/gabbai-minyan-switch";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { Button } from "@/components/ui/button";
import { mapAliyahApiError } from "@/lib/aliyah-errors";
import {
  CHIYUV_KIND_LABELS,
  MANUAL_CHIYUV_KINDS,
  type AliyahPlan,
  type AliyahPlanCandidate,
  type AliyahPlanSettings,
  type AliyahPlanSlot,
  type ChiyuvKind,
  type ManualChiyuvEvent,
  type ManualChiyuvKind
} from "@/lib/aliyah-plan-types";
import { formatAliyahCivilDate, nextExtraAliyahSlot } from "@/lib/aliyah-slots";
import { ALIYAH_DAY_KIND_LABELS, toAliyahCongregantOption, type AliyahCongregantOption } from "@/lib/aliyah-types";
import { CONGREGANT_TRIBE_LABELS, type CongregantMinyanOption, type CongregantRecord } from "@/lib/congregant-types";

type PlanPayload = {
  ok: boolean;
  error?: string;
  data?: {
    minyanim: CongregantMinyanOption[];
    congregants: AliyahCongregantOption[];
    occasions: Array<{ iso: string; label: string }>;
    serviceDate: string;
    plan: AliyahPlan | null;
    settings: AliyahPlanSettings | null;
    events: ManualChiyuvEvent[];
    warning?: string | null;
  };
};

type AddTarget = { kind: "slot"; key: string } | { kind: "event" };

const MANUAL_REASON = "נבחר ידנית";

function apiBase(synagogueId: string) {
  return `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/aliyot/plan`;
}

function formatStamp(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function AliyahPlanner({
  synagogueId,
  initialMinyanim,
  initialMinyanId,
  initialDate
}: {
  synagogueId: string;
  initialMinyanim: CongregantMinyanOption[];
  initialMinyanId: string | null;
  initialDate: string | null;
}) {
  const [minyanim, setMinyanim] = useState(initialMinyanim);
  const [minyanIndex, setMinyanIndex] = useState(() =>
    Math.max(0, initialMinyanim.findIndex((item) => item.id === initialMinyanId))
  );
  const [serviceDate, setServiceDate] = useState<string | null>(initialDate);
  const [occasions, setOccasions] = useState<Array<{ iso: string; label: string }>>([]);
  const [congregants, setCongregants] = useState<AliyahCongregantOption[]>([]);
  const [plan, setPlan] = useState<AliyahPlan | null>(null);
  const [slots, setSlots] = useState<AliyahPlanSlot[]>([]);
  const [settings, setSettings] = useState<AliyahPlanSettings | null>(null);
  const [events, setEvents] = useState<ManualChiyuvEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "recalc" | "save" | "email" | "settings" | "event">(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [eventDraft, setEventDraft] = useState<{
    congregantId: string | null;
    kind: ManualChiyuvKind;
    preferredSlot: string;
    notes: string;
  }>({ congregantId: null, kind: "chatan", preferredSlot: "", notes: "" });

  const minyan = minyanim[Math.min(minyanIndex, Math.max(0, minyanim.length - 1))] ?? null;
  const byId = useMemo(() => new Map(congregants.map((row) => [row.id, row])), [congregants]);
  const usedIds = useMemo(
    () => new Set(slots.flatMap((slot) => (slot.primary ? [slot.primary.congregantId] : []))),
    [slots]
  );

  const applyPlan = useCallback((next: AliyahPlan | null) => {
    setPlan(next);
    setSlots(next?.slots ?? []);
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!minyan?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);
    const params = new URLSearchParams({ minyanId: minyan.id });
    if (serviceDate) params.set("date", serviceDate);
    void fetch(`${apiBase(synagogueId)}?${params.toString()}`)
      .then(async (response) => {
        const payload = (await response.json()) as PlanPayload;
        if (cancelled) return;
        if (!payload.ok || !payload.data) {
          setError(mapAliyahApiError(payload.error));
          applyPlan(null);
          return;
        }
        setMinyanim(payload.data.minyanim);
        setCongregants(payload.data.congregants);
        setOccasions(payload.data.occasions);
        if (!serviceDate) setServiceDate(payload.data.serviceDate);
        setSettings(payload.data.settings);
        setEvents(payload.data.events);
        setWarning(payload.data.warning ? mapAliyahApiError(payload.data.warning) : null);
        applyPlan(payload.data.plan);
      })
      .catch(() => {
        if (!cancelled) setError("טעינת התכנון נכשלה");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [synagogueId, minyan?.id, serviceDate, applyPlan]);

  useEffect(() => {
    if (!minyan?.id || !serviceDate) return;
    const url = new URL(window.location.href);
    url.searchParams.set("minyan", minyan.id);
    url.searchParams.set("date", serviceDate);
    window.history.replaceState(null, "", url.toString());
  }, [minyan?.id, serviceDate]);

  function confirmLeave() {
    if (!dirty) return true;
    return window.confirm("יש שינויים בתכנון שלא נשמרו. לעבור בלי לשמור?");
  }

  function patchSlot(key: string, update: (slot: AliyahPlanSlot) => AliyahPlanSlot) {
    setSlots((prev) => prev.map((slot) => (slot.key === key ? update(slot) : slot)));
    setDirty(true);
    setMessage(null);
  }

  function candidateFor(congregantId: string): AliyahPlanCandidate {
    for (const slot of slots) {
      for (const item of [slot.primary, ...slot.backups]) {
        if (item?.congregantId === congregantId) return item;
      }
    }
    const unplaced = plan?.unplaced.find((item) => item.congregantId === congregantId);
    if (unplaced) return { congregantId, reason: unplaced.reason, chiyuv: unplaced.kind };
    return { congregantId, reason: MANUAL_REASON, chiyuv: null };
  }

  function setPrimary(slotKey: string, congregantId: string | null) {
    patchSlot(slotKey, (slot) => ({
      ...slot,
      primary: congregantId ? candidateFor(congregantId) : null,
      backups: congregantId ? slot.backups.filter((item) => item.congregantId !== congregantId) : slot.backups,
      locked: Boolean(congregantId),
      note: null
    }));
  }

  function promoteBackup(slotKey: string, index: number) {
    patchSlot(slotKey, (slot) => {
      const chosen = slot.backups[index];
      if (!chosen) return slot;
      const rest = slot.backups.filter((_, i) => i !== index);
      return {
        ...slot,
        primary: chosen,
        backups: slot.primary ? [slot.primary, ...rest] : rest,
        locked: true,
        note: null
      };
    });
  }

  function removeBackup(slotKey: string, index: number) {
    patchSlot(slotKey, (slot) => ({ ...slot, backups: slot.backups.filter((_, i) => i !== index) }));
  }

  function addExtraSlot(congregantId?: string) {
    const def = nextExtraAliyahSlot(slots.map((slot) => slot.key));
    setSlots((prev) => [
      ...prev,
      {
        ...def,
        primary: congregantId ? candidateFor(congregantId) : null,
        backups: [],
        locked: Boolean(congregantId),
        note: null
      }
    ]);
    setDirty(true);
  }

  async function recalc(nextEventsNote?: string) {
    if (!minyan?.id || !serviceDate) return;
    setBusy("recalc");
    setError(null);
    setMessage(null);
    try {
      const locked: Record<string, string> = {};
      for (const slot of slots) if (slot.locked && slot.primary) locked[slot.key] = slot.primary.congregantId;
      const response = await fetch(apiBase(synagogueId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minyanId: minyan.id, serviceDate, locked })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: { plan: AliyahPlan; events: ManualChiyuvEvent[] } };
      if (!payload.ok || !payload.data) {
        setError(mapAliyahApiError(payload.error));
        return;
      }
      setPlan({ ...payload.data.plan, saved: plan?.saved ?? false, savedAt: plan?.savedAt ?? null, emailedAt: plan?.emailedAt ?? null });
      setSlots(payload.data.plan.slots);
      setEvents(payload.data.events);
      setDirty(true);
      setMessage(nextEventsNote ?? "ההמלצה חושבה מחדש — שמרו כדי לקבע");
    } catch {
      setError("החישוב נכשל. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  async function save(): Promise<boolean> {
    if (!minyan?.id || !serviceDate || loading) return false;
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(apiBase(synagogueId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minyanId: minyan.id,
          serviceDate,
          slots: slots.map((slot, index) => ({
            slotKey: slot.key,
            sortOrder: index,
            locked: slot.locked,
            candidates: [slot.primary, ...slot.backups].map((item) => ({
              congregantId: item?.congregantId ?? null,
              reason: item?.reason ?? ""
            }))
          }))
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: { plan: AliyahPlan } };
      if (!payload.ok || !payload.data) {
        setError(mapAliyahApiError(payload.error));
        return false;
      }
      applyPlan(payload.data.plan);
      setMessage("התכנון נשמר");
      return true;
    } catch {
      setError("השמירה נכשלה. נסו שוב.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function ensureSaved() {
    if (!dirty && plan?.saved) return true;
    return save();
  }

  async function openPrint() {
    if (!minyan?.id || !serviceDate) return;
    const win = window.open("about:blank", "_blank");
    const ok = await ensureSaved();
    const params = new URLSearchParams({ minyanId: minyan.id, date: serviceDate });
    const url = `${apiBase(synagogueId)}/print?${params.toString()}`;
    if (!ok) {
      win?.close();
      return;
    }
    if (win) win.location.href = url;
    else window.location.href = url;
  }

  async function sendEmail() {
    if (!minyan?.id || !serviceDate) return;
    if (!(await ensureSaved())) return;
    setBusy("email");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase(synagogueId)}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minyanId: minyan.id, serviceDate })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: { recipients: string[] } };
      if (!payload.ok) {
        setError(mapAliyahApiError(payload.error));
        return;
      }
      const sentAt = new Date().toISOString();
      setPlan((prev) => (prev ? { ...prev, emailedAt: sentAt } : prev));
      setMessage(`נשלח במייל אל: ${(payload.data?.recipients ?? []).join(", ")}`);
    } catch {
      setError("השליחה נכשלה. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(next: AliyahPlanSettings) {
    if (!minyan?.id) return;
    setBusy("settings");
    setError(null);
    try {
      const response = await fetch(`${apiBase(synagogueId)}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minyanId: minyan.id, settings: next })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: { settings: AliyahPlanSettings } };
      if (!payload.ok || !payload.data) {
        setError(mapAliyahApiError(payload.error));
        return;
      }
      setSettings(payload.data.settings);
      setBusy(null);
      await recalc("ההגדרות נשמרו וההמלצה חושבה מחדש — שמרו את התכנון כדי לקבע");
    } catch {
      setError("שמירת ההגדרות נכשלה.");
    } finally {
      setBusy(null);
    }
  }

  async function addEvent() {
    if (!minyan?.id || !serviceDate || !eventDraft.congregantId) return;
    setBusy("event");
    setError(null);
    try {
      const response = await fetch(`${apiBase(synagogueId)}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minyanId: minyan.id,
          serviceDate,
          congregantId: eventDraft.congregantId,
          kind: eventDraft.kind,
          preferredSlot: eventDraft.preferredSlot || null,
          notes: eventDraft.notes
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapAliyahApiError(payload.error));
        return;
      }
      setEventDraft({ congregantId: null, kind: eventDraft.kind, preferredSlot: "", notes: "" });
      setBusy(null);
      await recalc("החיוב נוסף וההמלצה חושבה מחדש — שמרו כדי לקבע");
    } catch {
      setError("הוספת החיוב נכשלה.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteEvent(id: string) {
    setBusy("event");
    setError(null);
    try {
      const response = await fetch(`${apiBase(synagogueId)}/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapAliyahApiError(payload.error));
        return;
      }
      setEvents((prev) => prev.filter((item) => item.id !== id));
      setBusy(null);
      await recalc("החיוב הוסר וההמלצה חושבה מחדש — שמרו כדי לקבע");
    } catch {
      setError("מחיקת החיוב נכשלה.");
    } finally {
      setBusy(null);
    }
  }

  function handleCreated(row: CongregantRecord) {
    const option = toAliyahCongregantOption(row);
    setCongregants((prev) =>
      prev.some((item) => item.id === option.id)
        ? prev
        : [...prev, option].sort((a, b) => a.displayName.localeCompare(b.displayName, "he"))
    );
    if (addTarget?.kind === "slot") {
      patchSlot(addTarget.key, (slot) => ({
        ...slot,
        primary: { congregantId: option.id, reason: MANUAL_REASON, chiyuv: null },
        locked: true
      }));
    } else if (addTarget?.kind === "event") {
      setEventDraft((prev) => ({ ...prev, congregantId: option.id }));
    }
    setAddTarget(null);
    setAddQuery("");
  }

  if (!minyan) {
    return <p className="gabbai-hint">אין מניין. הוסיפו מניין בהגדרות בית הכנסת.</p>;
  }

  const occasionIndex = occasions.findIndex((item) => item.iso === serviceDate);
  const personLabel = (id: string) => {
    const person = byId.get(id);
    return person?.prayerName || person?.displayName || "מתפלל";
  };

  return (
    <CongregantThemeFrame minyan={minyan}>
      <GabbaiMinyanSwitch
        names={minyanim.map((item) => item.name)}
        index={Math.min(minyanIndex, minyanim.length - 1)}
        onChange={(index) => {
          if (!confirmLeave()) return;
          setMinyanIndex(index);
        }}
      />

      <div className="aliyah-toolbar">
        <div className="aliyah-date-row">
          <label className="congregant-field aliyah-occasion-field">
            <span>שבת / חג</span>
            <select
              value={serviceDate ?? ""}
              onChange={(event) => {
                if (!confirmLeave()) return;
                setServiceDate(event.target.value);
              }}
            >
              {occasions.map((option) => (
                <option key={option.iso} value={option.iso}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="aliyah-week-btn"
            disabled={occasionIndex <= 0}
            onClick={() => {
              if (occasionIndex <= 0 || !confirmLeave()) return;
              setServiceDate(occasions[occasionIndex - 1]!.iso);
            }}
          >
            הקודם
          </button>
          <button
            type="button"
            className="aliyah-week-btn"
            disabled={occasionIndex < 0 || occasionIndex >= occasions.length - 1}
            onClick={() => {
              if (occasionIndex < 0 || occasionIndex >= occasions.length - 1 || !confirmLeave()) return;
              setServiceDate(occasions[occasionIndex + 1]!.iso);
            }}
          >
            הבא
          </button>
        </div>
        {serviceDate ? <p className="aliyah-date-under">{formatAliyahCivilDate(serviceDate)}</p> : null}
        {plan ? (
          <p className="aliyah-meta">
            {plan.hebrewDate ? `${plan.hebrewDate} · ` : ""}
            {ALIYAH_DAY_KIND_LABELS[plan.kind]}
            {" · "}
            {plan.saved ? (
              <strong>תכנון שמור{plan.savedAt ? ` (${formatStamp(plan.savedAt)})` : ""}</strong>
            ) : (
              "המלצה אוטומטית — עדיין לא נשמרה"
            )}
            {plan.emailedAt ? ` · נשלח במייל ${formatStamp(plan.emailedAt)}` : ""}
          </p>
        ) : null}
        {warning ? <p className="gabbai-err">{warning}</p> : null}
      </div>

      {plan && plan.kind === "other" ? (
        <p className="aliyah-slot-hint aliyah-slot-warn">זה לא יום קריאה של שבת או חג — ההמלצה מוצגת לפי סדר שבת.</p>
      ) : null}

      {loading ? <GabbaiLoadingPanel title="מחשב המלצות…" /> : null}

      {!loading && plan ? (
        <>
          <div className="aliyah-plan-actions">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void recalc()}>
              {busy === "recalc" ? "מחשב…" : "חישוב מחדש"}
            </Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void openPrint()}>
              הדפסת דף לגבאי
            </Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void sendEmail()}>
              {busy === "email" ? "שולח…" : "שליחה במייל עכשיו"}
            </Button>
          </div>
          <p className="aliyah-slot-hint">
            עלייה שבחרתם ידנית ננעלת ונשמרת גם כשמחשבים מחדש. מסגרת זהובה = חיוב.
          </p>

          {slots.map((slot) => {
            const chiyuv = Boolean(slot.primary?.chiyuv);
            return (
              <section key={slot.key} className={`aliyah-slot aliyah-plan-slot${chiyuv ? " aliyah-plan-chiyuv" : ""}`}>
                <div className="aliyah-slot-head">
                  <h2>{slot.label}</h2>
                  <div className="aliyah-plan-head-actions">
                    {slot.primary?.chiyuv ? (
                      <span className="aliyah-chiyuv-badge">{CHIYUV_KIND_LABELS[slot.primary.chiyuv as ChiyuvKind]}</span>
                    ) : null}
                    {slot.primary ? (
                      <button
                        type="button"
                        className={`aliyah-lock-btn${slot.locked ? " is-locked" : ""}`}
                        aria-pressed={slot.locked}
                        title={slot.locked ? "נעול — לא ישתנה בחישוב מחדש" : "נעילה — לא ישתנה בחישוב מחדש"}
                        onClick={() => patchSlot(slot.key, (prev) => ({ ...prev, locked: !prev.locked }))}
                      >
                        {slot.locked ? "נעול" : "נעילה"}
                      </button>
                    ) : null}
                    {slot.extra ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSlots((prev) => prev.filter((item) => item.key !== slot.key));
                          setDirty(true);
                        }}
                      >
                        הסרה
                      </Button>
                    ) : null}
                  </div>
                </div>
                <AliyahCongregantPicker
                  congregants={congregants}
                  minyanId={minyan.id}
                  selectedId={slot.primary?.congregantId ?? null}
                  usedIds={usedIds}
                  preferTribe={preferredTribeForSlot(slot.key)}
                  onSelect={(id) => setPrimary(slot.key, id)}
                  onAddNew={(query) => {
                    setAddTarget({ kind: "slot", key: slot.key });
                    setAddQuery(query);
                  }}
                />
                {slot.primary?.reason ? (
                  <p className={`aliyah-plan-reason${chiyuv ? " is-chiyuv" : ""}`}>{slot.primary.reason}</p>
                ) : null}
                {slot.note ? <p className="aliyah-slot-hint aliyah-slot-warn">{slot.note}</p> : null}
                {slot.backups.length ? (
                  <div className="aliyah-backups">
                    <span className="aliyah-backups-title">מחליפים:</span>
                    {slot.backups.map((item, index) => {
                      const person = byId.get(item.congregantId);
                      return (
                        <div key={`${item.congregantId}-${index}`} className={`aliyah-backup${item.chiyuv ? " is-chiyuv" : ""}`}>
                          <div>
                            <strong>{personLabel(item.congregantId)}</strong>
                            {person ? <span className="aliyah-tribe">{CONGREGANT_TRIBE_LABELS[person.tribe]}</span> : null}
                            {item.reason ? <small>{item.reason}</small> : null}
                          </div>
                          <div className="aliyah-backup-actions">
                            <button type="button" onClick={() => promoteBackup(slot.key, index)}>
                              העבר לראשי
                            </button>
                            <button type="button" aria-label="הסרת מחליף" onClick={() => removeBackup(slot.key, index)}>
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}

          <div className="aliyah-extra-row">
            <Button type="button" variant="outline" onClick={() => addExtraSlot()}>
              הוספת עלייה
            </Button>
          </div>

          {plan.unplaced.length ? (
            <section className="aliyah-plan-box aliyah-plan-box-warn">
              <h2>חיובים שלא נמצא להם מקום</h2>
              <ul>
                {plan.unplaced.map((item) => (
                  <li key={item.congregantId}>
                    <span>
                      <strong>{personLabel(item.congregantId)}</strong> — {item.reason}
                    </span>
                    {!usedIds.has(item.congregantId) ? (
                      <button type="button" className="aliyah-inline-btn" onClick={() => addExtraSlot(item.congregantId)}>
                        הוספה כעלייה נוספת
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {plan.hashkavot.length ? (
            <section className="aliyah-plan-box">
              <h2>השכבות / אזכרות השבוע</h2>
              <ul>
                {plan.hashkavot.map((item, index) => (
                  <li key={`${item.congregantId}-${index}`}>
                    <span>
                      <strong>{item.congregantName}</strong> — {item.relationLabel}
                      {item.personName ? ` ${item.personName}` : ""} <small>({item.dateLabel})</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="aliyah-plan-box">
            <h2>חיובים מיוחדים לשבת הזו</h2>
            <p className="aliyah-slot-hint">
              יארצייט ובר מצווה מחושבים לבד מכרטיסי המתפללים. כאן מוסיפים מה שהמערכת לא יודעת: חתן, אבי הבן, אורח…
            </p>
            {events.length ? (
              <ul>
                {events.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{personLabel(item.congregantId)}</strong> — {CHIYUV_KIND_LABELS[item.kind]}
                      {item.preferredSlot ? ` · מבקש ${slots.find((slot) => slot.key === item.preferredSlot)?.label ?? item.preferredSlot}` : ""}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </span>
                    <button
                      type="button"
                      className="aliyah-inline-btn"
                      disabled={busy !== null}
                      onClick={() => void deleteEvent(item.id)}
                    >
                      הסרה
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="aliyah-event-form">
              <AliyahCongregantPicker
                congregants={congregants}
                minyanId={minyan.id}
                selectedId={eventDraft.congregantId}
                usedIds={new Set(events.map((item) => item.congregantId))}
                onSelect={(id) => setEventDraft((prev) => ({ ...prev, congregantId: id }))}
                onAddNew={(query) => {
                  setAddTarget({ kind: "event" });
                  setAddQuery(query);
                }}
              />
              <div className="aliyah-event-row">
                <label className="congregant-field">
                  <span>סוג</span>
                  <select
                    value={eventDraft.kind}
                    onChange={(event) => setEventDraft((prev) => ({ ...prev, kind: event.target.value as ManualChiyuvKind }))}
                  >
                    {MANUAL_CHIYUV_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {CHIYUV_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="congregant-field">
                  <span>עלייה מבוקשת</span>
                  <select
                    value={eventDraft.preferredSlot}
                    onChange={(event) => setEventDraft((prev) => ({ ...prev, preferredSlot: event.target.value }))}
                  >
                    <option value="">לא משנה</option>
                    {slots
                      .filter((slot) => !slot.extra)
                      .map((slot) => (
                        <option key={slot.key} value={slot.key}>
                          {slot.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="congregant-field">
                  <span>הערה</span>
                  <input
                    value={eventDraft.notes}
                    maxLength={200}
                    onChange={(event) => setEventDraft((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="למשל: שבע ברכות"
                  />
                </label>
              </div>
              <Button
                type="button"
                disabled={!eventDraft.congregantId || busy !== null}
                onClick={() => void addEvent()}
              >
                {busy === "event" ? "מוסיף…" : "הוספת חיוב"}
              </Button>
            </div>
          </section>

          {settings ? (
            <AliyahPlanSettingsPanel
              settings={settings}
              saving={busy === "settings"}
              onSave={(next) => void saveSettings(next)}
            />
          ) : null}
        </>
      ) : null}

      <GabbaiSaveBar
        label="שמירת התכנון"
        saving={busy === "save"}
        message={message}
        error={error}
        onSave={() => void save()}
      />

      {addTarget ? (
        <CongregantQuickAddDialog
          synagogueId={synagogueId}
          minyanim={minyanim}
          minyanId={minyan.id}
          nameQuery={addQuery}
          onClose={() => {
            setAddTarget(null);
            setAddQuery("");
          }}
          onCreated={handleCreated}
        />
      ) : null}
    </CongregantThemeFrame>
  );
}

function AliyahPlanSettingsPanel({
  settings,
  saving,
  onSave
}: {
  settings: AliyahPlanSettings;
  saving: boolean;
  onSave: (next: AliyahPlanSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);

  function move(index: number, delta: number) {
    setDraft((prev) => {
      const order = [...prev.priorityOrder];
      const target = index + delta;
      if (target < 0 || target >= order.length) return prev;
      [order[index], order[target]] = [order[target]!, order[index]!];
      return { ...prev, priorityOrder: order };
    });
  }

  return (
    <details className="aliyah-plan-box aliyah-settings">
      <summary>מנהגי המניין והגדרות ההמלצה</summary>

      <fieldset>
        <legend>מתי עולים ליארצייט</legend>
        <label>
          <input
            type="radio"
            checked={draft.yahrzeitTiming === "shabbat_before"}
            onChange={() => setDraft((prev) => ({ ...prev, yahrzeitTiming: "shabbat_before" }))}
          />
          בשבת שלפני היארצייט (או ביום עצמו אם הוא בשבת)
        </label>
        <label>
          <input
            type="radio"
            checked={draft.yahrzeitTiming === "shabbat_of_week"}
            onChange={() => setDraft((prev) => ({ ...prev, yahrzeitTiming: "shabbat_of_week" }))}
          />
          בשבת שבסוף שבוע היארצייט
        </label>
      </fieldset>

      <fieldset>
        <legend>יארצייט שנחשב חיוב</legend>
        <label>
          <input
            type="radio"
            checked={draft.yahrzeitScope === "parents"}
            onChange={() => setDraft((prev) => ({ ...prev, yahrzeitScope: "parents" }))}
          />
          רק אב ואם
        </label>
        <label>
          <input
            type="radio"
            checked={draft.yahrzeitScope === "all"}
            onChange={() => setDraft((prev) => ({ ...prev, yahrzeitScope: "all" }))}
          />
          כל הקרובים שבכרטיס (בעדיפות נמוכה יותר מהורים)
        </label>
      </fieldset>

      <fieldset>
        <legend>שיבוץ</legend>
        <label>
          <input
            type="checkbox"
            checked={draft.maftirForYahrzeit}
            onChange={(event) => setDraft((prev) => ({ ...prev, maftirForYahrzeit: event.target.checked }))}
          />
          בעל יארצייט מקבל מפטיר
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.maftirForBarMitzvah}
            onChange={(event) => setDraft((prev) => ({ ...prev, maftirForBarMitzvah: event.target.checked }))}
          />
          בר מצווה מקבל מפטיר
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.separateRelatives}
            onChange={(event) => setDraft((prev) => ({ ...prev, separateRelatives: event.target.checked }))}
          />
          לא לשבץ אב ובן / אחים בעליות סמוכות
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.extraAliyotForChiyuvim}
            onChange={(event) => setDraft((prev) => ({ ...prev, extraAliyotForChiyuvim: event.target.checked }))}
          />
          בשבת — להוסיף עליות כשיש יותר חיובים ממקומות
        </label>
        <label className="aliyah-settings-inline">
          מספר מחליפים לכל עלייה
          <select
            value={draft.backupsCount}
            onChange={(event) => setDraft((prev) => ({ ...prev, backupsCount: Number(event.target.value) }))}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="aliyah-settings-inline">
          לא להמליץ על מי שעלה ב־
          <input
            type="number"
            min={0}
            max={26}
            value={draft.minWeeksBetween}
            onChange={(event) => setDraft((prev) => ({ ...prev, minWeeksBetween: Number(event.target.value) || 0 }))}
          />
          השבועות האחרונים (אלא אם אין ברירה)
        </label>
      </fieldset>

      <fieldset>
        <legend>סדר קדימויות בין חיובים</legend>
        <ol className="aliyah-priority-list">
          {draft.priorityOrder.map((kind, index) => (
            <li key={kind}>
              <span>{CHIYUV_KIND_LABELS[kind]}</span>
              <span className="aliyah-priority-actions">
                <button type="button" disabled={index === 0} aria-label="העלאה" onClick={() => move(index, -1)}>
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === draft.priorityOrder.length - 1}
                  aria-label="הורדה"
                  onClick={() => move(index, 1)}
                >
                  ▼
                </button>
              </span>
            </li>
          ))}
        </ol>
      </fieldset>

      <fieldset>
        <legend>מייל אוטומטי</legend>
        <label>
          <input
            type="checkbox"
            checked={draft.emailEnabled}
            onChange={(event) => setDraft((prev) => ({ ...prev, emailEnabled: event.target.checked }))}
          />
          לשלוח את דף העליות במייל בבוקר ערב שבת / ערב חג
        </label>
        <label className="congregant-field">
          <span>נמענים (ריק = כל הגבאים של בית הכנסת)</span>
          <input
            value={draft.emailRecipients}
            dir="ltr"
            onChange={(event) => setDraft((prev) => ({ ...prev, emailRecipients: event.target.value }))}
            placeholder="gabbai@example.com, second@example.com"
          />
        </label>
      </fieldset>

      <Button type="button" disabled={saving} onClick={() => onSave(draft)}>
        {saving ? "שומר…" : "שמירת ההגדרות"}
      </Button>
    </details>
  );
}
