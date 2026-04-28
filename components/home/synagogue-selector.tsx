"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type SynagogueOption = {
  id: string;
  name: string;
};

export function SynagogueSelector({ synagogues }: { synagogues: SynagogueOption[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return synagogues;
    return synagogues.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [query, synagogues]);

  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-6 text-right shadow-sm md:p-8">
      <h2 className="mb-4 text-xl font-bold">בחר בית כנסת לתצוגה</h2>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="התחל להקליד שם בית כנסת..."
        className="mb-4 h-11 w-full rounded-md border border-border bg-background px-3 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-primary"
      />

      {filtered.length ? (
        <div className="max-h-[45vh] space-y-2 overflow-y-auto pe-1">
          {filtered.map((synagogue) => (
            <Button key={synagogue.id} asChild variant="outline" className="h-auto w-full justify-between px-4 py-3 text-right">
              <Link href={`/display?synagogueId=${encodeURIComponent(synagogue.id)}`}>
                <span className="text-base font-semibold">{synagogue.name}</span>
                <span className="text-sm text-muted-foreground">{synagogue.id}</span>
              </Link>
            </Button>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          לא נמצאו בתי כנסת התואמים לחיפוש.
        </p>
      )}
    </section>
  );
}
