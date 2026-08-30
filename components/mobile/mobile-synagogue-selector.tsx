"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { setPreferredSynagogue } from "@/lib/mobile-synagogue-preference";

type SynagogueOption = {
  id: string;
  name: string;
};

export function MobileSynagogueSelector({ synagogues }: { synagogues: SynagogueOption[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return synagogues;
    return synagogues.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [query, synagogues]);

  return (
    <section className="space-y-4">
      <div className="m-search">
        <Search className="m-search-icon" />
        <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בית כנסת..." />
      </div>

      {filtered.length ? (
        <ul className="m-list">
          {filtered.map((synagogue) => (
            <li key={synagogue.id}>
              <Link
                href={`/display?synagogueId=${encodeURIComponent(synagogue.id)}`}
                onClick={() => setPreferredSynagogue({ synagogueId: synagogue.id })}
                className="m-list-item"
              >
                <span className="min-w-0">
                  <span className="m-list-item-title">{synagogue.name}</span>
                  <span className="m-list-item-sub">{synagogue.id}</span>
                </span>
                <ChevronLeft className="m-list-chevron h-5 w-5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-empty">לא נמצאו בתי כנסת התואמים לחיפוש.</p>
      )}
    </section>
  );
}
