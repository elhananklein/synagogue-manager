"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  applyYahrzeitConversion,
  CONGREGANT_GENDER_LABELS,
  CONGREGANT_GENDERS,
  CONGREGANT_TRIBE_LABELS,
  CONGREGANT_TRIBES,
  congregantPrayerName,
  emptyYahrzeit,
  isYahrzeitStarted,
  YAHRZEIT_RELATION_LABELS,
  YAHRZEIT_RELATIONS,
  yahrzeitDiedAfterSunsetLabel,
  type BirthDateSource,
  type CongregantInput,
  type CongregantMinyanOption,
  type CongregantYahrzeit,
  type YahrzeitRelation
} from "@/lib/congregant-types";
import { hebrewMonthsForYear, hebrewDayLetters, hebrewYearLetters, isHebrewLeapYear, parseHebrewYearInput } from "@/lib/hebrew-civil-date";

export function CongregantFields({
  input,
  birthSource,
  minyanim,
  variant,
  onPatch,
  onBirthSource
}: {
  input: CongregantInput;
  birthSource: BirthDateSource;
  minyanim: CongregantMinyanOption[];
  variant: "gabbai" | "self";
  onPatch: (next: Partial<CongregantInput>, source?: BirthDateSource) => void;
  onBirthSource: (source: BirthDateSource) => void;
}) {
  const prayerName = congregantPrayerName(input);
  const self = variant === "self";
  const bornLabel = input.gender === "female" ? "נולדה אחרי השקיעה" : "נולד אחרי השקיעה";

  return (
    <>
      {prayerName ? <p className="congregant-prayer-name">שם לתפילה: {prayerName}</p> : null}

      <div className="congregant-grid congregant-grid--3">
        <label className="congregant-field">
          <span>שם פרטי</span>
          <input
            value={input.firstName}
            onChange={(e) => onPatch({ firstName: e.target.value })}
            required
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </label>
        <label className="congregant-field">
          <span>שם שני</span>
          <input
            value={input.middleName}
            onChange={(e) => onPatch({ middleName: e.target.value })}
            autoComplete="additional-name"
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </label>
        <label className="congregant-field">
          <span>משפחה</span>
          <input
            value={input.lastName}
            onChange={(e) => onPatch({ lastName: e.target.value })}
            required
            autoComplete="family-name"
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </label>
      </div>

      <div className="congregant-grid congregant-grid--3" style={{ marginTop: "0.75rem" }}>
        <label className="congregant-field">
          <span>כינוי</span>
          <input
            value={input.nickname}
            onChange={(e) => onPatch({ nickname: e.target.value })}
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </label>
        <label className="congregant-field">
          <span>שם האב</span>
          <input
            value={input.fatherName}
            onChange={(e) => onPatch({ fatherName: e.target.value })}
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </label>
        <label className="congregant-field">
          <span>שם האם</span>
          <input
            value={input.motherName}
            onChange={(e) => onPatch({ motherName: e.target.value })}
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </label>
      </div>

      <div className="congregant-grid congregant-grid--3" style={{ marginTop: "0.75rem" }}>
        <label className="congregant-field">
          <span>גבר / אשה</span>
          <select
            value={input.gender}
            onChange={(e) => onPatch({ gender: e.target.value as CongregantInput["gender"] })}
          >
            {CONGREGANT_GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {CONGREGANT_GENDER_LABELS[gender]}
              </option>
            ))}
          </select>
        </label>
        <label className="congregant-field">
          <span>כהן / לוי / ישראל</span>
          <select
            value={input.tribe}
            onChange={(e) => onPatch({ tribe: e.target.value as CongregantInput["tribe"] })}
          >
            {CONGREGANT_TRIBES.map((tribe) => (
              <option key={tribe} value={tribe}>
                {CONGREGANT_TRIBE_LABELS[tribe]}
              </option>
            ))}
          </select>
        </label>
        <label className="congregant-field">
          <span>מניין</span>
          <select value={input.minyanId ?? ""} onChange={(e) => onPatch({ minyanId: e.target.value || null })}>
            <option value="">{self ? "עדיין לא בחרתי" : "בלי מניין קבוע"}</option>
            {minyanim.map((minyan) => (
              <option key={minyan.id} value={minyan.id}>
                {minyan.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="congregant-grid congregant-grid--2" style={{ marginTop: "0.75rem" }}>
        <label className="congregant-field">
          <span>{self ? "טלפון" : "טלפון"}</span>
          <input
            value={input.phone}
            onChange={(e) => onPatch({ phone: e.target.value })}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            required={self}
          />
        </label>
        <label className="congregant-field">
          <span>מייל</span>
          <input
            value={input.email}
            onChange={(e) => onPatch({ email: e.target.value })}
            type="email"
            autoComplete="email"
            enterKeyHint="next"
            inputMode="email"
          />
        </label>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <p className="mb-2 text-sm font-bold" style={{ color: "var(--c-muted)" }}>
          תאריך לידה — ממלאים אחד, השני מחושב. שנה חובה.
        </p>
        <div className="congregant-source" role="group" aria-label="איזה תאריך למלא">
          <button type="button" aria-pressed={birthSource === "gregorian"} onClick={() => onBirthSource("gregorian")}>
            ממלאים לועזי
          </button>
          <button type="button" aria-pressed={birthSource === "hebrew"} onClick={() => onBirthSource("hebrew")}>
            ממלאים עברי
          </button>
        </div>
      </div>

      <div className="congregant-grid congregant-grid--2" style={{ marginTop: "0.75rem" }}>
        <label className="congregant-field">
          <span>תאריך לועזי</span>
          <input
            type="date"
            value={input.gregorianBirthDate}
            readOnly={birthSource !== "gregorian"}
            onChange={(e) => onPatch({ gregorianBirthDate: e.target.value }, "gregorian")}
            autoComplete="bday"
          />
        </label>
        <div className="congregant-grid congregant-grid--3">
          <HebrewDateFields
            day={input.hebrewBirthDay}
            month={input.hebrewBirthMonth}
            year={input.hebrewBirthYear}
            disabled={birthSource !== "hebrew"}
            onChange={(next) =>
              onPatch(
                {
                  ...(next.day != null ? { hebrewBirthDay: next.day } : {}),
                  ...(next.month != null ? { hebrewBirthMonth: next.month } : {}),
                  ...(next.year != null ? { hebrewBirthYear: next.year } : {})
                },
                "hebrew"
              )
            }
          />
        </div>
      </div>

      <label className="congregant-check" style={{ marginTop: "0.65rem" }}>
        <input
          type="checkbox"
          checked={input.bornAfterSunset}
          onChange={(e) => onPatch({ bornAfterSunset: e.target.checked })}
        />
        {bornLabel}
      </label>

      <YahrzeitSection input={input} onPatch={onPatch} />

      {self ? (
        <label className="congregant-check" style={{ marginTop: "0.35rem" }}>
          <input
            type="checkbox"
            checked={input.receivesAliyah}
            onChange={(e) => onPatch({ receivesAliyah: e.target.checked })}
          />
          מעוניין לעלות לתורה
        </label>
      ) : null}
    </>
  );
}

function YahrzeitSection({
  input,
  onPatch
}: {
  input: CongregantInput;
  onPatch: (next: Partial<CongregantInput>) => void;
}) {
  function addYahrzeit() {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `new-${Date.now()}`;
    onPatch({ yahrzeits: [...(input.yahrzeits ?? []), { ...emptyYahrzeit("father"), id }] });
  }

  return (
    <div className="congregant-yahrzeit">
      <p className="mb-1 text-sm font-bold" style={{ color: "var(--c-muted)" }}>
        יארצייט
      </p>
      <p className="mb-2 text-xs" style={{ color: "var(--c-muted)" }}>
        אופציונלי. שבעה קרובים, או סבא וסבתא.
      </p>
      {(input.yahrzeits ?? []).map((item, index) => (
        <YahrzeitCard
          key={item.id || `yahrzeit-${index}`}
          item={item}
          onChange={(next) =>
            onPatch({
              yahrzeits: (input.yahrzeits ?? []).map((row, rowIndex) => (rowIndex === index ? next : row))
            })
          }
          onRemove={() => onPatch({ yahrzeits: (input.yahrzeits ?? []).filter((_, rowIndex) => rowIndex !== index) })}
        />
      ))}
      <button type="button" className="congregant-yahrzeit-add" onClick={addYahrzeit}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        הוספת יארצייט
      </button>
    </div>
  );
}

function YahrzeitCard({
  item,
  onChange,
  onRemove
}: {
  item: CongregantYahrzeit;
  onChange: (next: CongregantYahrzeit) => void;
  onRemove: () => void;
}) {
  const [source, setSource] = useState<BirthDateSource>(item.gregorianDate ? "gregorian" : "hebrew");
  const started = isYahrzeitStarted(item);

  function patchDate(next: Partial<CongregantYahrzeit>, nextSource: BirthDateSource) {
    setSource(nextSource);
    onChange(applyYahrzeitConversion({ ...item, ...next }, nextSource).next);
  }

  return (
    <div className="congregant-yahrzeit-card">
      <div className="congregant-yahrzeit-card-head">
        <label className="congregant-field" style={{ margin: 0, flex: 1 }}>
          <span>קרבה</span>
          <select
            value={item.relation}
            onChange={(e) => onChange({ ...item, relation: e.target.value as YahrzeitRelation })}
          >
            {YAHRZEIT_RELATIONS.map((relation) => (
              <option key={relation} value={relation}>
                {YAHRZEIT_RELATION_LABELS[relation]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="congregant-yahrzeit-remove" onClick={onRemove}>
          הסרה
        </button>
      </div>
      <label className="congregant-field">
        <span>שם הנפטר — לא חובה</span>
        <input
          value={item.personName}
          onChange={(e) => onChange({ ...item, personName: e.target.value })}
          autoCapitalize="words"
        />
      </label>
      <div className="congregant-source" role="group" aria-label="תאריך יארצייט">
        <button type="button" aria-pressed={source === "gregorian"} onClick={() => patchDate({}, "gregorian")}>
          ממלאים לועזי
        </button>
        <button type="button" aria-pressed={source === "hebrew"} onClick={() => patchDate({}, "hebrew")}>
          ממלאים עברי
        </button>
      </div>
      <div className="congregant-grid congregant-grid--2" style={{ marginTop: "0.75rem" }}>
        <label className="congregant-field">
          <span>תאריך לועזי</span>
          <input
            type="date"
            value={item.gregorianDate}
            readOnly={source !== "gregorian"}
            onChange={(e) => patchDate({ gregorianDate: e.target.value }, "gregorian")}
          />
        </label>
        <div className="congregant-grid congregant-grid--3">
          <HebrewDateFields
            day={started ? item.hebrewDay : 0}
            month={item.hebrewMonth}
            year={item.hebrewYear}
            disabled={source !== "hebrew"}
            allowEmptyDay
            onChange={(next) =>
              patchDate(
                {
                  ...(next.day != null ? { hebrewDay: next.day } : {}),
                  ...(next.month != null ? { hebrewMonth: next.month } : {}),
                  ...(next.year != null ? { hebrewYear: next.year } : {})
                },
                "hebrew"
              )
            }
          />
        </div>
      </div>
      <label className="congregant-check" style={{ marginTop: "0.65rem" }}>
        <input
          type="checkbox"
          checked={item.afterSunset}
          onChange={(e) => patchDate({ afterSunset: e.target.checked }, source)}
        />
        {yahrzeitDiedAfterSunsetLabel(item.relation)}
      </label>
    </div>
  );
}

const HEBREW_DAY_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 1);

function HebrewDateFields({
  day,
  month,
  year,
  disabled,
  allowEmptyDay = false,
  onChange
}: {
  day: number;
  month: number;
  year: number;
  disabled: boolean;
  allowEmptyDay?: boolean;
  onChange: (next: { day?: number; month?: number; year?: number }) => void;
}) {
  const months = useMemo(() => hebrewMonthsForYear(year || null), [year]);
  const [yearDraft, setYearDraft] = useState<string | null>(null);
  const yearShown = yearDraft ?? (year > 0 ? hebrewYearLetters(year) : "");

  function commitYear(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange({ year: 0, month });
      return;
    }
    const parsed = parseHebrewYearInput(trimmed);
    if (!parsed) return;
    const leap = isHebrewLeapYear(parsed);
    const nextMonth = !leap && month === 13 ? 12 : month;
    onChange({ year: parsed, month: nextMonth });
  }

  return (
    <>
      <label className="congregant-field">
        <span>יום עברי</span>
        <select
          disabled={disabled}
          value={day >= 1 && day <= 30 ? day : ""}
          onChange={(e) => onChange({ day: Number(e.target.value) || 0 })}
        >
          {allowEmptyDay || !day ? <option value="">—</option> : null}
          {HEBREW_DAY_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {hebrewDayLetters(item)}
            </option>
          ))}
        </select>
      </label>
      <label className="congregant-field">
        <span>חודש עברי</span>
        <select
          disabled={disabled}
          value={month || ""}
          onChange={(e) => onChange({ month: Number(e.target.value) })}
        >
          {months.map((item) => (
            <option key={item.month} value={item.month}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="congregant-field">
        <span>שנה עברית</span>
        <input
          type="text"
          inputMode="text"
          lang="he"
          dir="rtl"
          autoComplete="off"
          spellCheck={false}
          placeholder="תשפ״ו"
          readOnly={disabled}
          value={yearShown}
          onFocus={() => {
            if (!disabled) setYearDraft(year > 0 ? hebrewYearLetters(year) : "");
          }}
          onChange={(e) => setYearDraft(e.target.value)}
          onBlur={(e) => {
            commitYear(e.target.value);
            setYearDraft(null);
          }}
        />
      </label>
    </>
  );
}

