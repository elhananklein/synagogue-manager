"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BulletinItemInput } from "@/lib/bulletin-board";

export type BulletinItemModel = BulletinItemInput & { localKey: string };

function newLocalKey() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyItem(kind: "text" | "image" = "text"): BulletinItemModel {
  return {
    localKey: newLocalKey(),
    kind,
    title: "",
    bodyText: "",
    imageUrl: "",
    sortOrder: 0,
    published: true
  };
}

export function BulletinBoardEditor({
  synagogueId,
  items,
  onChange
}: {
  synagogueId: string;
  items: BulletinItemModel[];
  onChange: (items: BulletinItemModel[]) => void;
}) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const updateItem = (localKey: string, patch: Partial<BulletinItemModel>) => {
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

  async function uploadImage(localKey: string, file: File) {
    setUploadingKey(localKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/bulletin/upload`, {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { ok: boolean; url?: string; error?: string };
      if (!payload.ok || !payload.url) {
        alert(payload.error ?? "העלאת התמונה נכשלה");
        return;
      }
      updateItem(localKey, { kind: "image", imageUrl: payload.url });
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>לוח מודעות</CardTitle>
        <p className="text-sm text-muted-foreground">
          הודעות טקסט או תמונה. יש להוסיף מסך «לוח מודעות» בהגדרות המניין. משך ההצגה במסך = זמן לכל הודעה.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={item.localKey} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">הודעה {index + 1}</span>
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

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">סוג</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3"
                  value={item.kind}
                  onChange={(e) => updateItem(item.localKey, { kind: e.target.value as "text" | "image" })}
                >
                  <option value="text">טקסט</option>
                  <option value="image">תמונה</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">כותרת (אופציונלי)</label>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background px-3"
                  value={item.title ?? ""}
                  onChange={(e) => updateItem(item.localKey, { title: e.target.value })}
                />
              </div>
            </div>

            {item.kind === "text" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">תוכן ההודעה</label>
                <textarea
                  className="min-h-[6rem] w-full rounded-md border border-border bg-background px-3 py-2"
                  value={item.bodyText ?? ""}
                  onChange={(e) => updateItem(item.localKey, { bodyText: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">כתובת תמונה</label>
                  <input
                    className="h-10 w-full rounded-md border border-border bg-background px-3"
                    value={item.imageUrl ?? ""}
                    onChange={(e) => updateItem(item.localKey, { imageUrl: e.target.value })}
                    placeholder="https://… או /uploads/bulletin/…"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={(el) => {
                      fileRefs.current[item.localKey] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadImage(item.localKey, file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingKey === item.localKey}
                    onClick={() => fileRefs.current[item.localKey]?.click()}
                  >
                    {uploadingKey === item.localKey ? "מעלה…" : "העלאת תמונה מהמחשב"}
                  </Button>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="max-h-24 rounded border object-contain" />
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">כיתוב מתחת לתמונה (אופציונלי)</label>
                  <input
                    className="h-10 w-full rounded-md border border-border bg-background px-3"
                    value={item.bodyText ?? ""}
                    onChange={(e) => updateItem(item.localKey, { bodyText: e.target.value })}
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.published !== false}
                onChange={(e) => updateItem(item.localKey, { published: e.target.checked })}
              />
              מוצג בלוח המודעות
            </label>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange([...items, { ...createEmptyItem("text"), sortOrder: items.length + 1 }])
            }
          >
            + הודעת טקסט
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange([...items, { ...createEmptyItem("image"), sortOrder: items.length + 1 }])
            }
          >
            + הודעת תמונה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function mapBulletinFromApi(
  rows: Array<{
    id: string;
    kind: "text" | "image";
    title: string | null;
    bodyText: string | null;
    imageUrl: string | null;
    sortOrder: number;
    published: boolean;
  }>
): BulletinItemModel[] {
  return rows.map((row) => ({
    localKey: row.id,
    id: row.id,
    kind: row.kind,
    title: row.title ?? "",
    bodyText: row.bodyText ?? "",
    imageUrl: row.imageUrl ?? "",
    sortOrder: row.sortOrder,
    published: row.published
  }));
}

export function mapBulletinForSave(items: BulletinItemModel[]): BulletinItemInput[] {
  return items.map((item, index) => ({
    id: item.id,
    kind: item.kind,
    title: item.title?.trim() || null,
    bodyText: item.bodyText?.trim() || null,
    imageUrl: item.imageUrl?.trim() || null,
    sortOrder: index + 1,
    published: item.published !== false
  }));
}
