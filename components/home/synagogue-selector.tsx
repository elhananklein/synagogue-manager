"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";

export type HomeMinyanOption = {
  index: number;
  name: string;
};

export type HomeSynagogueOption = {
  id: string;
  name: string;
  minyanim: HomeMinyanOption[];
};

function displayHref(synagogueId: string, minyanIndex?: number) {
  const query = new URLSearchParams({ synagogueId });
  if (minyanIndex != null && minyanIndex > 0) query.set("minyan", String(minyanIndex));
  return `/display?${query.toString()}`;
}

export function SynagogueSelector({ synagogues }: { synagogues: HomeSynagogueOption[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return synagogues;
    return synagogues.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized) ||
        item.minyanim.some((minyan) => minyan.name.toLowerCase().includes(normalized))
    );
  }, [query, synagogues]);

  return (
    <section className="home-selector">
      <h2 className="home-selector-title">בחירת בית כנסת ומניין</h2>
      <p className="home-selector-hint">חפשו לפי שם, ואז בחרו את המניין לתצוגת הקיר.</p>

      <label className="home-search">
        <Search aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpenId(null);
          }}
          placeholder="הקלידו שם בית כנסת או מניין…"
          autoComplete="off"
        />
      </label>

      {filtered.length ? (
        <div className="home-list">
          {filtered.map((synagogue) => {
            const minyanCount = synagogue.minyanim.length;
            const isOpen = openId === synagogue.id;
            const single = minyanCount <= 1;
            const onlyMinyan = synagogue.minyanim[0];

            if (single) {
              return (
                <article key={synagogue.id} className="home-synagogue">
                  <Link
                    href={displayHref(synagogue.id, onlyMinyan?.index)}
                    className="home-synagogue-btn"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span className="min-w-0">
                      <span className="home-synagogue-name">{synagogue.name}</span>
                      <span className="home-synagogue-meta">
                        {onlyMinyan ? onlyMinyan.name : "מניין ברירת מחדל"}
                      </span>
                    </span>
                    <ChevronLeft className="home-synagogue-chevron" aria-hidden />
                  </Link>
                </article>
              );
            }

            return (
              <article key={synagogue.id} className="home-synagogue" data-open={isOpen ? "" : undefined}>
                <button
                  type="button"
                  className="home-synagogue-btn"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId((current) => (current === synagogue.id ? null : synagogue.id))}
                >
                  <span className="min-w-0">
                    <span className="home-synagogue-name">{synagogue.name}</span>
                    <span className="home-synagogue-meta">{minyanCount} מניינים — בחרו מניין</span>
                  </span>
                  <ChevronLeft className="home-synagogue-chevron" aria-hidden />
                </button>
                {isOpen ? (
                  <div className="home-minyanim">
                    {synagogue.minyanim.map((minyan) => (
                      <Link
                        key={`${synagogue.id}-${minyan.index}`}
                        href={displayHref(synagogue.id, minyan.index)}
                        className="home-minyan-link"
                      >
                        <span className="home-minyan-name">{minyan.name}</span>
                        <span className="home-minyan-index">מניין {minyan.index}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="home-empty">לא נמצאו בתי כנסת או מניינים התואמים לחיפוש.</p>
      )}
    </section>
  );
}
