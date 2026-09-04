"use client";

import { useMemo } from "react";
import {
  CONGREGANT_TRIBE_LABELS,
  CONGREGANT_TRIBES,
  congregantPrayerName,
  type BirthDateSource,
  type CongregantInput,
  type CongregantMinyanOption
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

      <div className="congregant-grid congregant-grid--2" style={{ marginTop: "0.75rem" }}>
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
        נולד אחרי השקיעה
      </label>

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
