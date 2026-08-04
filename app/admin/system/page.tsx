"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EMPTY_LOCATION_VALUE,
  SynagogueLocationForm,
  type SynagogueLocationValue
} from "@/components/admin/synagogue-location-form";
import { GabbaimManager } from "@/components/admin/gabbaim-manager";
import { LogoutButton } from "@/components/admin/logout-button";

type SynagogueItem = {
  id: string;
  name: string;
  created_at: string;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  timezone: string | null;
  candle_lighting_minutes: number | null;
  havdalah_mode: string | null;
  havdalah_minutes: number | null;
};

function mapApiError(error?: string) {
  if (!error) return "הפעולה נכשלה";
  if (error === "missing_service_role_key") return "חסר משתנה סביבה SUPABASE_SERVICE_ROLE_KEY בצד השרת.";
  if (error === "invalid_id") return "המזהה חייב להכיל רק אותיות באנגלית קטנות, מספרים ומקף (3-40 תווים).";
  if (error === "missing_name") return "יש להזין שם בית כנסת.";
  if (error === "invalid_coordinates") return "קואורדינטות לא תקינות (קו רוחב ואורך חייבים להגיע יחד ובטווח חוקי).";
  if (error === "invalid_elevation") return "ערך גובה לא תקין.";
  if (error === "invalid_candle_minutes") return "דקות הדלקת נרות חייבות להיות בין 0 ל-120.";
  if (error === "invalid_havdalah_minutes") return "דקות צאת שבת חייבות להיות בין 0 ל-120.";
  if (error === "not_found") return "בית הכנסת לא נמצא.";
  if (error.includes("duplicate key")) return "המזהה כבר קיים במערכת. בחר מזהה אחר.";
  if (error.includes("row-level security")) return "אין הרשאת כתיבה לטבלה (RLS). יש להגדיר service role key.";
  return error;
}

function toApiBody(loc: SynagogueLocationValue) {
  return {
    locality: loc.locality.trim() || null,
    latitude: loc.latitude,
    longitude: loc.longitude,
    elevation: loc.elevation,
    candle_lighting_minutes: loc.candleLightingMinutes,
    havdalah_mode: loc.havdalahMode,
    havdalah_minutes: loc.havdalahMinutes
  };
}

function itemToValue(item: SynagogueItem): SynagogueLocationValue {
  return {
    locality: item.locality ?? "",
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    elevation: item.elevation ?? null,
    candleLightingMinutes: item.candle_lighting_minutes ?? 40,
    havdalahMode: item.havdalah_mode === "minutes" ? "minutes" : "tzeit",
    havdalahMinutes: item.havdalah_minutes ?? 72
  };
}

export default function SystemAdminPage() {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState<SynagogueLocationValue>(EMPTY_LOCATION_VALUE);
  const [items, setItems] = useState<SynagogueItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<SynagogueLocationValue>(EMPTY_LOCATION_VALUE);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/system/synagogues", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data?: SynagogueItem[]; error?: string };
    if (payload.ok) {
      setItems(payload.data ?? []);
      return;
    }
    setError(mapApiError(payload.error));
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSynagogue(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const response = await fetch("/api/admin/system/synagogues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, ...toApiBody(location) })
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setError(mapApiError(payload.error));
      return;
    }
    setMessage("בית כנסת נוצר בהצלחה");
    setId("");
    setName("");
    setLocation(EMPTY_LOCATION_VALUE);
    await load();
  }

  function startEdit(item: SynagogueItem) {
    setEditingId(item.id);
    setEditValue(itemToValue(item));
    setEditMessage(null);
    setEditError(null);
  }

  async function saveEdit(itemId: string) {
    setEditMessage(null);
    setEditError(null);
    const response = await fetch("/api/admin/system/synagogues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, ...toApiBody(editValue) })
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setEditError(mapApiError(payload.error));
      return;
    }
    setEditMessage("המיקום נשמר בהצלחה");
    await load();
    setEditingId(null);
  }

  return (
    <main className="container py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ממשק מנהל מערכת</h1>
          <p className="mt-2 text-muted-foreground">
            כאן יוצרים בתי כנסת חדשים, מגדירים מיקום ומנהג, ומנהלים גבאים.
          </p>
        </div>
        <LogoutButton />
      </div>

      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle>הגדרת בית כנסת חדש</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={createSynagogue}>
            <label className="text-sm font-medium">מזהה בית כנסת (id)</label>
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              placeholder="beit-rimon"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            />
            <label className="text-sm font-medium">שם בית כנסת</label>
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              placeholder='בית כנסת "בית רימון"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-3 text-sm font-semibold">מיקום ומנהג (לחישוב זמני היום וכניסת/יציאת שבת)</p>
              <SynagogueLocationForm value={location} onChange={setLocation} />
            </div>

            <div className="mt-2 flex items-center gap-3">
              <Button type="submit">צור בית כנסת</Button>
              {message ? <span className="text-sm text-green-600">{message}</span> : null}
              {error ? <span className="text-sm text-red-600">{error}</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle>בתי כנסת מוגדרים</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="font-semibold">{item.name}</div>
                <div className="text-muted-foreground">id: {item.id}</div>
                <div className="text-muted-foreground">
                  מיקום:{" "}
                  {item.latitude != null && item.longitude != null
                    ? `${item.locality ? `${item.locality} — ` : ""}${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                    : "לא הוגדר (ברירת מחדל: ירושלים)"}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a className="text-primary underline" href={`/admin/gabbai/${item.id}`}>
                    כניסה לממשק גבאי
                  </a>
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => (editingId === item.id ? setEditingId(null) : startEdit(item))}
                  >
                    {editingId === item.id ? "סגור עריכה" : "ערוך מיקום/מנהג"}
                  </button>
                </div>

                {editingId === item.id ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <SynagogueLocationForm value={editValue} onChange={setEditValue} />
                    <div className="mt-3 flex items-center gap-3">
                      <Button type="button" onClick={() => void saveEdit(item.id)}>
                        שמור מיקום
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                        ביטול
                      </Button>
                      {editMessage ? <span className="text-sm text-green-600">{editMessage}</span> : null}
                      {editError ? <span className="text-sm text-red-600">{editError}</span> : null}
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
            {!items.length ? <li className="text-sm text-muted-foreground">אין עדיין בתי כנסת מוגדרים</li> : null}
          </ul>
        </CardContent>
      </Card>

      <GabbaimManager synagogues={items.map((i) => ({ id: i.id, name: i.name }))} />
    </main>
  );
}
