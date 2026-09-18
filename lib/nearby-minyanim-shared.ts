export const NEARBY_RADIUS_KM_OPTIONS = [1, 3, 10] as const;
export const NEARBY_HOURS_OPTIONS = [1, 3, 12] as const;
export const DEFAULT_NEARBY_RADIUS_KM = 3;
export const DEFAULT_NEARBY_HOURS = 12;

export type NearbyMinyanHit = {
  synagogueId: string;
  synagogueName: string;
  locality: string | null;
  minyanName: string;
  minyanIndex: number;
  distanceKm: number;
  distanceLabel: string;
  walkingLabel: string;
  nextPrayer: {
    label: string;
    time: string;
    minutesUntil: number;
    dayOffset: 0 | 1;
    untilLabel: string;
  };
};

export type NearbyMinyanimResult = {
  radiusKm: number;
  hours: number;
  synagoguesWithLocation: number;
  synagoguesInRange: number;
  items: NearbyMinyanHit[];
};
