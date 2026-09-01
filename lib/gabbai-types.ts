export type PrayerType =
  | "שחרית"
  | "מנחה"
  | "ערבית"
  | "מנחה ערב שבת"
  | "שחרית שבת"
  | "מנחה שבת"
  | "ערבית מוצ'ש";

export type ScheduleTimesListMode = "all" | "prayers_only";
export type PrayerMode = "fixed" | "relative" | "parasha";
export type PrayerCategory = "weekday" | "shabbat";

export type ScreenKey =
  | "main"
  | "mainInfo"
  | "clock"
  | "omer"
  | "halacha"
  | "dailyLearning"
  | "prayerTimes"
  | "shabbat"
  | "bulletin"
  | "fullSchedule";

export type PrayerSetting = {
  category: PrayerCategory;
  prayerType: PrayerType | "";
  daysOfWeek: number[];
  mode: PrayerMode;
  fixedTime: string | null;
  zmanAnchor: string | null;
  offsetMinutes: number | null;
  roundMode: "none" | "up" | "down";
  parashaKey: string | null;
  lockToSunday: boolean;
  clientId: string;
  unsaved?: boolean;
};

export type ScreenSetting = {
  screenKey: ScreenKey | "";
  sortOrder: number;
  durationSeconds: number;
  enabled: boolean;
  unsaved?: boolean;
};
