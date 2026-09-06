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
import { hebrewMonthsForYear, isHebrewLeapYear } from "@/lib/hebrew-civil-date";

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
  const months = useMemo(
    () => hebrewMonthsForYear(input.hebrewBirthYear || null),
    [input.hebrewBirthYear]
  );
  const prayerName = congregantPrayerName(input);
  const hebrewYear = input.hebrewBirthYear > 0 ? String(input.hebrewBirthYear) : "";
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
          <label className="congregant-field">
            <span>יום עברי</span>
            <input
              type="number"
              min={1}
              max={30}
              inputMode="numeric"
              readOnly={birthSource !== "hebrew"}
              value={input.hebrewBirthDay || ""}
              onChange={(e) => onPatch({ hebrewBirthDay: Number(e.target.value) || 0 }, "hebrew")}
            />
          </label>
          <label className="congregant-field">
            <span>חודש עברי</span>
            <select
              disabled={birthSource !== "hebrew"}
              value={input.hebrewBirthMonth || ""}
              onChange={(e) => onPatch({ hebrewBirthMonth: Number(e.target.value) }, "hebrew")}
            >
              {months.map((month) => (
                <option key={month.month} value={month.month}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <label className="congregant-field">
            <span>שנה עברית</span>
            <input
              type="number"
              min={5000}
              max={6000}
              inputMode="numeric"
              readOnly={birthSource !== "hebrew"}
              value={hebrewYear}
              onChange={(e) => {
                const year = Number(e.target.value) || 0;
                const leap = year ? isHebrewLeapYear(year) : true;
                const month = !leap && input.hebrewBirthMonth === 13 ? 12 : input.hebrewBirthMonth;
                onPatch({ hebrewBirthYear: year, hebrewBirthMonth: month }, "hebrew");
              }}
            />
          </label>
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
  const months = hebrewMonthsForYear(item.hebrewYear || null);

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
          <label className="congregant-field">
            <span>יום עברי</span>
            <input
              type="number"
              min={1}
              max={30}
              inputMode="numeric"
              readOnly={source !== "hebrew"}
              value={started ? item.hebrewDay || "" : ""}
              onChange={(e) => patchDate({ hebrewDay: Number(e.target.value) || 0 }, "hebrew")}
            />
          </label>
          <label className="congregant-field">
            <span>חודש עברי</span>
            <select
              disabled={source !== "hebrew"}
              value={item.hebrewMonth || ""}
              onChange={(e) => patchDate({ hebrewMonth: Number(e.target.value) }, "hebrew")}
            >
              {months.map((month) => (
                <option key={month.month} value={month.month}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <label className="congregant-field">
            <span>שנה עברית</span>
            <input
              type="number"
              min={5000}
              max={6000}
              inputMode="numeric"
              readOnly={source !== "hebrew"}
              value={item.hebrewYear > 0 ? String(item.hebrewYear) : ""}
              onChange={(e) => {
                const year = Number(e.target.value) || 0;
                const leap = year ? isHebrewLeapYear(year) : true;
                const month = !leap && item.hebrewMonth === 13 ? 12 : item.hebrewMonth;
                patchDate({ hebrewYear: year, hebrewMonth: month }, "hebrew");
              }}
            />
          </label>
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

