"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, MapPin, Navigation } from "lucide-react";
import { setPreferredSynagogue } from "@/lib/mobile-synagogue-preference";
import { setSynagogueIdCookie } from "@/lib/synagogue-id";
import {
  DEFAULT_NEARBY_HOURS,
  DEFAULT_NEARBY_RADIUS_KM,
  NEARBY_HOURS_OPTIONS,
  NEARBY_RADIUS_KM_OPTIONS,
  type NearbyMinyanHit,
  type NearbyMinyanimResult
} from "@/lib/nearby-minyanim-shared";

type GeoState = "idle" | "locating" | "searching" | "ready" | "denied" | "unavailable" | "error";

const HOUR_LABELS: Record<number, string> = {
  1: "שעה",
  3: "3 שעות",
  12: "היום"
};

function geolocationErrorState(code: number | undefined): GeoState {
  if (code === 1) return "denied";
  if (code === 2 || code === 3) return "unavailable";
  return "error";
}

function emptyHint(result: NearbyMinyanimResult | null) {
  if (!result) return "לא נמצא מניין בטווח.";
  if (result.synagoguesWithLocation === 0) {
    return "עדיין אין מיקום במפה לבתי הכנסת במערכת.";
  }
  if (result.synagoguesInRange === 0) {
    return "אין בית כנסת בטווח הזה. נסו להגדיל את רדיוס החיפוש.";
  }
  return "יש בית כנסת בקרבת מקום, אבל אין תפילה בחלון הזמן שנבחר. נסו להרחיב את השעות.";
}

export function MobileNearbyMinyanSearch() {
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
  const [hours, setHours] = useState<number>(DEFAULT_NEARBY_HOURS);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<GeoState>("idle");
  const [result, setResult] = useState<NearbyMinyanimResult | null>(null);

  const searchAt = useCallback(async (lat: number, lng: number, nextRadius = radiusKm, nextHours = hours) => {
    setState("searching");
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radiusKm: String(nextRadius),
        hours: String(nextHours)
      });
      const response = await fetch(`/api/nearby-minyanim?${params.toString()}`);
      const payload = (await response.json()) as { ok?: boolean } & Partial<NearbyMinyanimResult>;
      if (!response.ok || !payload.ok) {
        setState("error");
        return;
      }
      setResult({
        radiusKm: payload.radiusKm ?? nextRadius,
        hours: payload.hours ?? nextHours,
        synagoguesWithLocation: payload.synagoguesWithLocation ?? 0,
        synagoguesInRange: payload.synagoguesInRange ?? 0,
        items: Array.isArray(payload.items) ? (payload.items as NearbyMinyanHit[]) : []
      });
      setState("ready");
    } catch {
      setState("error");
    }
  }, [hours, radiusKm]);

  const requestLocation = useCallback(
    (nextRadius = radiusKm, nextHours = hours) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setState("unavailable");
        return;
      }
      if (origin) {
        void searchAt(origin.lat, origin.lng, nextRadius, nextHours);
        return;
      }
      setState("locating");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextOrigin = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setOrigin(nextOrigin);
          void searchAt(nextOrigin.lat, nextOrigin.lng, nextRadius, nextHours);
        },
        (error) => {
          setState(geolocationErrorState(error.code));
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 }
      );
    },
    [hours, origin, radiusKm, searchAt]
  );

  const changeRadius = (value: number) => {
    setRadiusKm(value);
    if (state === "ready" || origin) requestLocation(value, hours);
  };

  const changeHours = (value: number) => {
    setHours(value);
    if (state === "ready" || origin) requestLocation(radiusKm, value);
  };

  const busy = state === "locating" || state === "searching";

  return (
    <section className="m-nearby">
      <button type="button" className="m-nearby-btn" onClick={() => requestLocation()} disabled={busy}>
        {busy ? <Loader2 className="m-nearby-spin h-5 w-5" /> : <Navigation className="h-5 w-5" />}
        {state === "locating" ? "מאתרים את המיקום…" : state === "searching" ? "מחפשים מניין קרוב…" : "מניין קרוב"}
      </button>

      <div className="m-nearby-filters">
        <div className="m-nearby-filter">
          <span className="m-nearby-filter-label">טווח</span>
          <div className="m-nearby-options">
            {NEARBY_RADIUS_KM_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                className={`m-nearby-option${radiusKm === value ? " is-on" : ""}`}
                aria-pressed={radiusKm === value}
                onClick={() => changeRadius(value)}
                disabled={busy}
              >
                {value} ק״מ
              </button>
            ))}
          </div>
        </div>
        <div className="m-nearby-filter">
          <span className="m-nearby-filter-label">זמן</span>
          <div className="m-nearby-options">
            {NEARBY_HOURS_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                className={`m-nearby-option${hours === value ? " is-on" : ""}`}
                aria-pressed={hours === value}
                onClick={() => changeHours(value)}
                disabled={busy}
              >
                {HOUR_LABELS[value] ?? `${value} שעות`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state === "denied" ? (
        <p className="m-empty">כדי למצוא מניין קרוב צריך לאשר גישה למיקום. אפשר לחפש גם לפי שם.</p>
      ) : null}
      {state === "unavailable" ? (
        <p className="m-empty">לא הצלחנו לקרוא את המיקום במכשיר. אפשר לנסות שוב, או לחפש לפי שם.</p>
      ) : null}
      {state === "error" ? <p className="m-empty">החיפוש נכשל כרגע. נסו שוב בעוד רגע.</p> : null}

      {state === "ready" && result ? (
        result.items.length ? (
          <ul className="m-list">
            {result.items.map((item) => (
              <li key={`${item.synagogueId}-${item.minyanIndex}`}>
                <Link
                  href={`/m/display?synagogueId=${encodeURIComponent(item.synagogueId)}&minyan=${item.minyanIndex}`}
                  onClick={() => {
                    setPreferredSynagogue({ synagogueId: item.synagogueId, minyan: String(item.minyanIndex) });
                    setSynagogueIdCookie(item.synagogueId);
                  }}
                  className="m-list-item"
                >
                  <span className="min-w-0">
                    <span className="m-list-item-title">{item.synagogueName}</span>
                    <span className="m-list-item-sub">
                      {item.minyanName}
                      {item.locality ? ` · ${item.locality}` : ""}
                    </span>
                    <span className="m-nearby-hit-meta">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.distanceLabel} · {item.walkingLabel}
                    </span>
                    <span className="m-nearby-prayer">
                      {item.nextPrayer.label} {item.nextPrayer.time}
                      {item.nextPrayer.dayOffset === 1 ? " · מחר" : ""}
                      <span> · {item.nextPrayer.untilLabel}</span>
                    </span>
                  </span>
                  <ChevronLeft className="m-list-chevron h-5 w-5" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-empty">{emptyHint(result)}</p>
        )
      ) : null}
    </section>
  );
}
