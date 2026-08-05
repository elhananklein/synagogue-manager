"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AdminTabItem = {
  id: string;
  label: string;
  /** תווית קצרה למובייל (אופציונלי) */
  shortLabel?: string;
};

/**
 * סרגל טאבים אופקי עם גלילה במובייל.
 * תומך ב-role=tablist לנגישות.
 */
export function AdminTabs({
  items,
  value,
  onChange,
  className,
  trailing
}: {
  items: AdminTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** אלמנט נוסף בסוף הסרגל (למשל כפתור «הוסף») */
  trailing?: ReactNode;
}) {
  return (
    <div className={cn("border-b border-border", className)}>
      <div
        role="tablist"
        className="-mb-px flex items-stretch gap-1 overflow-x-auto overscroll-x-contain pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.id)}
              className={cn(
                "shrink-0 touch-manipulation whitespace-nowrap rounded-t-md px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
                selected
                  ? "border border-b-background border-border bg-background text-foreground"
                  : "border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
        {trailing ? <div className="mr-1 flex shrink-0 items-center self-center">{trailing}</div> : null}
      </div>
    </div>
  );
}
