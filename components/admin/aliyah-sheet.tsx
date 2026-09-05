"use client";

import { useEffect, useMemo, useState } from "react";
import { CongregantThemeFrame } from "@/components/admin/congregant-theme-frame";
import { CongregantQuickAddDialog } from "@/components/admin/congregant-quick-add-dialog";
import { AliyahCongregantPicker } from "@/components/admin/aliyah-congregant-picker";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiMinyanSwitch } from "@/components/admin/gabbai-minyan-switch";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { Button } from "@/components/ui/button";
import { mapAliyahApiError } from "@/lib/aliyah-errors";
import { addDaysIso, nextExtraAliyahSlot } from "@/lib/aliyah-slots";
import { ALIYAH_DAY_KIND_LABELS, toAliyahCongregantOption, type AliyahCongregantOption, type AliyahSheet, type AliyahSlotState } from "@/lib/aliyah-types";
import { CONGREGANT_TRIBE_LABELS, type CongregantMinyanOption, type CongregantRecord } from "@/lib/congregant-types";

type WorkspacePayload = {
  ok: boolean;
  error?: string;
  data?: {
    minyanim: CongregantMinyanOption[];
    congregants: AliyahCongregantOption[];
    sheet: AliyahSheet | null;
    serviceDate: string;
  };
};

export function AliyahSheetEditor({
  synagogueId,
  initialMinyanim,
  initialCongregants,
  initialDate
}: {
  synagogueId: string;
  initialMinyanim: CongregantMinyanOption[];
  initialCongregants: AliyahCongregantOption[];
  initialDate: string;
}) {
  const [minyanim, setMinyanim] = useState(initialMinyanim);
  const [congregants, setCongregants] = useState(initialCongregants);
  const [minyanIndex, setMinyanIndex] = useState(0);
  const [serviceDate, setServiceDate] = useState(initialDate);
  const [sheet, setSheet] = useState<AliyahSheet | null>(null);
  const [slots, setSlots] = useState<AliyahSlotState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addForKey, setAddForKey] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState("");

  const minyan = minyanim[Math.min(minyanIndex, Math.max(0, minyanim.length - 1))] ?? minyanim[0] ?? null;

  useEffect(() => {
    if (!minyan?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ minyanId: minyan.id, date: serviceDate });
    void fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/aliyot?${params.toString()}`)
      .then(async (response) => {
        const payload = (await response.json()) as WorkspacePayload;
        if (cancelled) return;
        if (!payload.ok || !payload.data) {
          setError(mapAliyahApiError(payload.error));
          setSheet(null);
          setSlots([]);
          return;
        }
        setMinyanim(payload.data.minyanim);
        setCongregants(payload.data.congregants);
        setSheet(payload.data.sheet);
        setSlots(payload.data.sheet?.slots ?? []);
        setDirty(false);
      })
      .catch(() => {
        if (!cancelled) setError("טעינת העליות נכשלה");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [synagogueId, minyan?.id, serviceDate]);

  const byId = useMemo(() => new Map(congregants.map((row) => [row.id, row])), [congregants]);
  const usedIds = useMemo(
    () => new Set(slots.map((slot) => slot.congregantId).filter((id): id is string => Boolean(id))),
    [slots]
  );

  function confirmLeave() {
    if (!dirty) return true;
    return window.confirm("יש שינויים שלא נשמרו. לעבור בלי לשמור?");
  }

  function patchSlot(key: string, next: Partial<AliyahSlotState>) {
    setSlots((prev) => prev.map((slot) => (slot.key === key ? { ...slot, ...next } : slot)));
    setDirty(true);
    setMessage(null);
  }

  function assignCongregant(slotKey: string, congregantId: string | null) {
    const person = congregantId ? byId.get(congregantId) : null;
    const noKohen =
      slotKey === "kohen" && person && person.tribe !== "kohen" ? ("yisrael" as const) : null;
    patchSlot(slotKey, { congregantId, noKohenResolution: noKohen });
  }

  async function save() {
    if (loading) return;
    if (!minyan?.id) {
      setError("שמרו קודם את המניין בהגדרות בית הכנסת.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/aliyot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minyanId: minyan.id,
          serviceDate,
          assignments: slots.map((slot, index) => ({
            slotKey: slot.key,
            sortOrder: index,
            congregantId: slot.congregantId,
            noKohenResolution: slot.noKohenResolution,
            notes: slot.notes
          }))
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: { sheet: AliyahSheet | null } };
      if (!payload.ok) {
        setError(mapAliyahApiError(payload.error));
        return;
      }
      if (payload.data?.sheet) {
        setSheet(payload.data.sheet);
        setSlots(payload.data.sheet.slots);
      }
      setDirty(false);
      setMessage("העליות נשמרו");
    } catch {
      setError("השמירה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  function handleCreated(row: CongregantRecord) {
    const option = toAliyahCongregantOption(row);
    setCongregants((prev) => {
      if (prev.some((item) => item.id === option.id)) return prev;
      return [...prev, option].sort((a, b) => a.displayName.localeCompare(b.displayName, "he"));
    });
    if (addForKey) {
      const noKohen = addForKey === "kohen" && option.tribe !== "kohen" ? "yisrael" : null;
      patchSlot(addForKey, { congregantId: option.id, noKohenResolution: noKohen });
    }
    setAddForKey(null);
    setAddQuery("");
  }

  if (!minyan) {
    return <p className="gabbai-hint">אין מניין. הוסיפו מניין בהגדרות בית הכנסת.</p>;
  }

  const addSlot = addForKey ? slots.find((slot) => slot.key === addForKey) : null;

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
          <label className="congregant-field">
            <span>תאריך הקריאה</span>
            <input
              type="date"
              value={serviceDate}
              onChange={(event) => {
                if (!confirmLeave()) return;
                setServiceDate(event.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="aliyah-week-btn"
            onClick={() => {
              if (!confirmLeave()) return;
              setServiceDate(addDaysIso(serviceDate, -7));
            }}
          >
            שבוע קודם
          </button>
          <button
            type="button"
            className="aliyah-week-btn"
            onClick={() => {
              if (!confirmLeave()) return;
              setServiceDate(addDaysIso(serviceDate, 7));
            }}
          >
            שבוע הבא
          </button>
        </div>
        {sheet ? (
          <p className="aliyah-meta">
            <strong>
              {sheet.weekday}
              {sheet.hebrewDate ? ` · ${sheet.hebrewDate}` : ""}
            </strong>
            {sheet.parashaLabel ? ` · ${sheet.parashaLabel}` : ""}
            {` · ${ALIYAH_DAY_KIND_LABELS[sheet.kind]}`}
            {!sheet.isKriahDay ? " — זה לא יום קריאה רגיל של שבת או חג, אפשר בכל זאת לרשום." : " · שחרית"}
          </p>
        ) : null}
      </div>

      {loading ? <GabbaiLoadingPanel title="טוען עליות…" /> : null}

      {!loading
        ? slots.map((slot) => {
            const person = slot.congregantId ? byId.get(slot.congregantId) : null;
            const mismatch =
              slot.expectedTribe && person && person.tribe !== slot.expectedTribe
                ? slot.key === "kohen" && person.tribe === "yisrael"
                  ? "אין כהן — נרשם ישראל במקומו"
                  : `בדרך כלל כאן ${CONGREGANT_TRIBE_LABELS[slot.expectedTribe]}`
                : null;
            return (
              <section key={slot.key} className="aliyah-slot">
                <div className="aliyah-slot-head">
                  <h2>{slot.label}</h2>
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
                <AliyahCongregantPicker
                  congregants={congregants}
                  minyanId={minyan.id}
                  selectedId={slot.congregantId}
                  usedIds={usedIds}
                  onSelect={(id) => assignCongregant(slot.key, id)}
                  onAddNew={(query) => {
                    setAddForKey(slot.key);
                    setAddQuery(query);
                  }}
                />
                {slot.key === "kohen" && !person ? (
                  <p className="aliyah-slot-hint">אם אין כהן במניין — בחרו ישראל שעולה במקומו.</p>
                ) : null}
                {mismatch ? <p className={`aliyah-slot-hint ${slot.key === "kohen" ? "" : "aliyah-slot-warn"}`}>{mismatch}</p> : null}
              </section>
            );
          })
        : null}

      {!loading ? (
        <div className="aliyah-extra-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const extra = nextExtraAliyahSlot(slots.map((slot) => slot.key));
              setSlots((prev) => [
                ...prev,
                {
                  ...extra,
                  congregantId: null,
                  noKohenResolution: null,
                  notes: ""
                }
              ]);
              setDirty(true);
            }}
          >
            הוספת עלייה
          </Button>
        </div>
      ) : null}

      <GabbaiSaveBar
        label="שמירת העליות"
        saving={saving}
        message={message}
        error={error}
        onSave={() => void save()}
      />

      {addForKey && addSlot ? (
        <CongregantQuickAddDialog
          synagogueId={synagogueId}
          minyanim={minyanim}
          minyanId={minyan.id}
          nameQuery={addQuery}
          onClose={() => {
            setAddForKey(null);
            setAddQuery("");
          }}
          onCreated={handleCreated}
        />
      ) : null}
    </CongregantThemeFrame>
  );
}
