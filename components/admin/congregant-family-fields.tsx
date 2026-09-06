"use client";

import { useMemo, useState } from "react";
import { CongregantQuickAddDialog } from "@/components/admin/congregant-quick-add-dialog";
import { Button } from "@/components/ui/button";
import {
  FAMILY_RELATION_LABELS,
  FAMILY_RELATIONS,
  congregantDisplayName,
  genderForRelation,
  type CongregantFamilyLink,
  type CongregantMinyanOption,
  type CongregantRecord,
  type FamilyRelation
} from "@/lib/congregant-types";

type FamilyOption = {
  id: string;
  name: string;
  gender: CongregantRecord["gender"];
};

export function CongregantFamilyFields({
  synagogueId,
  minyanim,
  minyanId,
  excludeId,
  people,
  value,
  onChange,
  onPersonAdded
}: {
  synagogueId: string;
  minyanim: CongregantMinyanOption[];
  minyanId: string | null;
  excludeId?: string;
  people: FamilyOption[];
  value: CongregantFamilyLink[];
  onChange: (next: CongregantFamilyLink[]) => void;
  onPersonAdded: (row: CongregantRecord) => void;
}) {
  const [relatedId, setRelatedId] = useState("");
  const [relation, setRelation] = useState<FamilyRelation>("son");
  const [adding, setAdding] = useState(false);

  const used = useMemo(() => new Set(value.map((item) => item.relatedId)), [value]);
  const available = people.filter((person) => person.id !== excludeId && !used.has(person.id));
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  function addLink() {
    if (!relatedId) return;
    const person = byId.get(relatedId);
    const nextRelation =
      person && person.gender !== genderForRelation(relation)
        ? person.gender === "female"
          ? relation === "husband"
            ? "wife"
            : "daughter"
          : relation === "wife"
            ? "husband"
            : "son"
        : relation;
    onChange([...value, { relatedId, relation: nextRelation }]);
    setRelatedId("");
  }

  return (
    <div style={{ marginTop: "1.1rem" }}>
      <p className="mb-2 text-sm font-bold" style={{ color: "var(--c-muted)" }}>
        בן משפחה
      </p>
      <p className="mb-2 text-xs" style={{ color: "var(--c-muted)" }}>
        קישור לבן, בת, בעל או אשה שכבר רשומים — או הוספת כרטיס חדש.
      </p>

      {value.length ? (
        <ul className="space-y-2" style={{ marginBottom: "0.75rem" }}>
          {value.map((link) => {
            const person = byId.get(link.relatedId);
            return (
              <li key={link.relatedId} className="congregant-grid congregant-grid--2" style={{ alignItems: "end" }}>
                <p className="congregant-prayer-name" style={{ margin: 0 }}>
                  {FAMILY_RELATION_LABELS[link.relation]}: {person?.name ?? "מתפלל"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(value.filter((item) => item.relatedId !== link.relatedId))}
                >
                  הסרה
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="congregant-grid congregant-grid--3">
        <label className="congregant-field">
          <span>קרבה</span>
          <select value={relation} onChange={(e) => setRelation(e.target.value as FamilyRelation)}>
            {FAMILY_RELATIONS.map((item) => (
              <option key={item} value={item}>
                {FAMILY_RELATION_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="congregant-field">
          <span>מתפלל רשום</span>
          <select value={relatedId} onChange={(e) => setRelatedId(e.target.value)}>
            <option value="">בחירה מהרשימה</option>
            {available.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="outline" onClick={addLink} disabled={!relatedId}>
            קישור
          </Button>
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            מתפלל חדש
          </Button>
        </div>
      </div>

      {adding ? (
        <CongregantQuickAddDialog
          synagogueId={synagogueId}
          minyanim={minyanim}
          minyanId={minyanId}
          nameQuery=""
          initialGender={genderForRelation(relation)}
          onClose={() => setAdding(false)}
          onCreated={(row) => {
            onPersonAdded(row);
            onChange([...value, { relatedId: row.id, relation }]);
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function toFamilyOptions(rows: CongregantRecord[]): FamilyOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: congregantDisplayName(row),
    gender: row.gender
  }));
}
