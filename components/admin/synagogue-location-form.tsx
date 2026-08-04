"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const MapPicker = dynamic(() => import("@/components/admin/map-picker"), {
  ssr: false,
  loading: () => <div className="flex h-[300px] items-center justify-center rounded-md border border-border text-sm text-muted-foreground">טוען מפה…</div>
});

export type HavdalahMode = "tzeit" | "minutes";

export type SynagogueLocationValue = {
  locality: string;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  candleLightingMinutes: number;
  havdalahMode: HavdalahMode;
  havdalahMinutes: number;
};

export const EMPTY_LOCATION_VALUE: SynagogueLocationValue = {
  locality: "",
  latitude: null,
  longitude: null,
  elevation: null,
  candleLightingMinutes: 40,
  havdalahMode: "tzeit",
  havdalahMinutes: 72
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { elevation?: number[] };
    const value = data.elevation?.[0];
    return typeof value === "number" ? Math.round(value) : null;
  } catch {
    return null;
  }
}

export function SynagogueLocationForm({
  value,
  onChange
}: {
  value: SynagogueLocationValue;
  onChange: (next: SynagogueLocationValue) => void;
}) {
  const [query, setQuery] = useState(value.locality);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingElevation, setLoadingElevation] = useState(false);
  const lastElevationKey = useRef<string | null>(null);

  useEffect(() => {
    setQuery(value.locality);
  }, [value.locality]);

  // שליפת גובה אוטומטית כשמשתנה הנקודה (עם דה-באונס קצר)
  useEffect(() => {
    if (value.latitude == null || value.longitude == null) return;
    const key = `${value.latitude.toFixed(5)},${value.longitude.toFixed(5)}`;
    if (lastElevationKey.current === key) return;
    lastElevationKey.current = key;
    let cancelled = false;
    setLoadingElevation(true);
    const timer = setTimeout(async () => {
      const elev = await fetchElevation(value.latitude!, value.longitude!);
      if (!cancelled && elev != null) {
        onChange({ ...value, elevation: elev });
      }
      if (!cancelled) setLoadingElevation(false);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.latitude, value.longitude]);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=il&accept-language=he&limit=6&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        setResults((await res.json()) as NominatimResult[]);
      }
    } catch {
      /* התעלמות — המשתמש יכול לבחור ידנית על המפה */
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(r: NominatimResult) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const shortName = r.display_name.split(",")[0]?.trim() || r.display_name;
    setResults([]);
    setQuery(shortName);
    onChange({ ...value, locality: shortName, latitude: lat, longitude: lon });
  }

  function setPoint(lat: number, lng: number) {
    onChange({ ...value, latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium">יישוב</label>
        <div className="flex gap-2">
          <input
            className="h-10 flex-1 rounded-md border border-border bg-background px-3"
            placeholder="לדוגמה: מודיעין עילית"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
            <Search className="ml-1 h-4 w-4" />
            {searching ? "מחפש…" : "חפש"}
          </Button>
        </div>
        {results.length ? (
          <ul className="rounded-md border border-border bg-background">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lon}-${i}`}>
                <button
                  type="button"
                  onClick={() => chooseResult(r)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-right text-sm hover:bg-muted"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{r.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">כוונון מדויק על המפה (לחצו או גררו את הסיכה)</label>
        <MapPicker latitude={value.latitude} longitude={value.longitude} onChange={setPoint} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">קו רוחב</label>
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            inputMode="decimal"
            value={value.latitude ?? ""}
            onChange={(e) => onChange({ ...value, latitude: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">קו אורך</label>
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            inputMode="decimal"
            value={value.longitude ?? ""}
            onChange={(e) => onChange({ ...value, longitude: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            גובה (מטר) {loadingElevation ? "— טוען…" : ""}
          </label>
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            inputMode="numeric"
            value={value.elevation ?? ""}
            onChange={(e) => onChange({ ...value, elevation: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">הדלקת נרות (דקות לפני שקיעה)</label>
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            inputMode="numeric"
            value={value.candleLightingMinutes}
            onChange={(e) =>
              onChange({ ...value, candleLightingMinutes: e.target.value === "" ? 0 : Number(e.target.value) })
            }
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">צאת שבת</label>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={value.havdalahMode}
            onChange={(e) => onChange({ ...value, havdalahMode: e.target.value as HavdalahMode })}
          >
            <option value="tzeit">צאת הכוכבים (8.5°)</option>
            <option value="minutes">מספר דקות אחרי שקיעה</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">דקות ליציאה</label>
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
            inputMode="numeric"
            disabled={value.havdalahMode !== "minutes"}
            value={value.havdalahMinutes}
            onChange={(e) =>
              onChange({ ...value, havdalahMinutes: e.target.value === "" ? 0 : Number(e.target.value) })
            }
          />
        </div>
      </div>
    </div>
  );
}
