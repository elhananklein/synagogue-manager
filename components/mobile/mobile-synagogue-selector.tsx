"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";

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
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש בית כנסת..."
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pe-10 ps-4 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
        />
      </div>

      {filtered.length ? (
        <ul className="space-y-2">
          {filtered.map((synagogue) => (
            <li key={synagogue.id}>
              <Link
                href={`/display?synagogueId=${encodeURIComponent(synagogue.id)}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">{synagogue.name}</span>
                  <span className="block truncate text-sm text-slate-400">{synagogue.id}</span>
                </span>
                <ChevronLeft className="h-5 w-5 shrink-0 text-emerald-600" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          לא נמצאו בתי כנסת התואמים לחיפוש.
        </p>
      )}
    </section>
  );
}
