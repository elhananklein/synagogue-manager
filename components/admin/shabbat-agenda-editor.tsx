"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShabbatAgendaItemInput } from "@/lib/shabbat-agenda";

export type ShabbatAgendaItemModel = ShabbatAgendaItemInput & { localKey: string };

function newLocalKey() {
  return `sa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyItem(): ShabbatAgendaItemModel {
  return {
    localKey: newLocalKey(),
    sortOrder: 0,
    itemTime: "",
    content: "",
    published: true
  };
}

export function ShabbatAgendaEditor({
  items,
  onChange,
  parashaHint,
  className
}: {
  items: ShabbatAgendaItemModel[];
  onChange: (items: ShabbatAgendaItemModel[]) => void;
  /** למשל «פרשת ראה» — להקשר בלבד */
  parashaHint?: string | null;
  className?: string;
}) {
  const updateItem = (localKey: string, patch: Partial<ShabbatAgendaItemModel>) => {
    onChange(items.map((item) => (item.localKey === localKey ? { ...item, ...patch } : item)));
  };

  const removeItem = (localKey: string) => {
    onChange(items.filter((item) => item.localKey !== localKey));
  };

  const moveItem = (localKey: string, direction: -1 | 1) => {
    const idx = items.findIndex((item) => item.localKey === localKey);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [row] = copy.splice(idx, 1);
    copy.splice(next, 0, row);
    onChange(copy.map((item, i) => ({ ...item, sortOrder: i + 1 })));
  };

  const addItem = () => {
    onChange([...items, { ...createEmptyItem(), sortOrder: items.length + 1 }]);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>לוח זמנים לשבת</CardTitle>
        <p className="text-sm text-muted-foreground">
          סדר היום לשבת הקרובה למניין זה
          {parashaHint ? (
            <>
              {" "}
              (<span className="font-medium text-foreground">פרשת {parashaHint}</span>)
            </>
          ) : null}
          . לכל שורה תוכן (חובה) ושעה אופציונלית. לדוגמה: כניסת שבת, שיר השירים, קריאת התורה, קידוש.
          מוצג במסך «שבת» של המניין.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            עדיין אין פריטים. הוסיפו את סדר היום לשבת.
          </p>
        ) : null}

        {items.map((item, index) => (
          <div key={item.localKey} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">שורה {index + 1}</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveItem(item.localKey, -1)}>
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(item.localKey, 1)}
                >
                  ↓
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => removeItem(item.localKey)}>
                  מחק
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <div>
                <label className="mb-1 block text-sm font-medium">שעה (אופציונלי)</label>
                <input
                  type="time"
                  className="h-10 w-full rounded-md border border-border bg-background px-3"
                  value={item.itemTime ?? ""}
                  onChange={(e) => updateItem(item.localKey, { itemTime: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">תוכן</label>
                <input
                  type="text"
                  className="h-10 w-full rounded-md border border-border bg-background px-3"
                  placeholder='למשל: שיר השירים / קריאת התורה ע"י… / קידוש לאחר התפילה'
                  value={item.content}
                  onChange={(e) => updateItem(item.localKey, { content: e.target.value })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.published !== false}
                onChange={(e) => updateItem(item.localKey, { published: e.target.checked })}
              />
              מוצג בתצוגה
            </label>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addItem}>
          הוסף שורה
        </Button>
      </CardContent>
    </Card>
  );
}

export function mapShabbatAgendaFromApi(
  rows: Array<{
    id?: string;
    sortOrder: number;
    itemTime?: string | null;
    content?: string;
    published?: boolean;
    localKey?: string;
  }>
): ShabbatAgendaItemModel[] {
  return rows.map((row, index) => {
    const id = row.id?.trim() || undefined;
    return {
      localKey: row.localKey || id || `sa-load-${index}-${Date.now()}`,
      id,
      sortOrder: row.sortOrder,
      itemTime: row.itemTime ?? "",
      content: row.content ?? "",
      published: row.published !== false
    };
  });
}

export function mapShabbatAgendaForSave(items: ShabbatAgendaItemModel[]): ShabbatAgendaItemInput[] {
  return items.map((item, index) => ({
    id: item.id,
    sortOrder: index + 1,
    itemTime: item.itemTime?.trim() || null,
    content: item.content ?? "",
    published: item.published !== false
  }));
}
