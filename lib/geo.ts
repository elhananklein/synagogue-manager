const EARTH_KM = 6371;

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 0.1) return "פחות מ־100 מ׳";
  if (km < 1) return `${Math.round(km * 1000)} מ׳`;
  const rounded = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${rounded} ק״מ`;
}

/** הליכה עירונית בקירוב — כ־5 ק״מ לשעה. */
export function walkingMinutesFromKm(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.max(1, Math.round((km / 5) * 60));
}

export function formatMinutesUntil(minutes: number): string {
  const value = Math.max(0, Math.round(minutes));
  if (value <= 1) return "עכשיו";
  if (value < 60) return `בעוד ${value} דקות`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 1 && rest === 0) return "בעוד שעה";
  if (hours === 1) return `בעוד שעה ו־${rest} דקות`;
  if (rest === 0) return `בעוד ${hours} שעות`;
  return `בעוד ${hours} שעות ו־${rest} דקות`;
}
