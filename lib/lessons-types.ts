export type LessonSeriesInput = {
  id?: string;
  name: string;
  audience: string | null;
  price: string | null;
  displayAsGroup: boolean;
  published: boolean;
  sortOrder: number;
};

export type LessonInput = {
  id?: string;
  seriesId: string | null;
  weekday: number | null;
  lessonDate: string | null;
  startTime: string;
  topic: string | null;
  speaker: string | null;
  audience: string | null;
  price: string | null;
  published: boolean;
  sortOrder: number;
};

export type LessonSeries = LessonSeriesInput & { id: string };
export type Lesson = LessonInput & { id: string };

/** פריט מוכן לתצוגה בלוח (קיר / מובייל / שבת). */
export type LessonDisplayItem = {
  id: string;
  time: string;
  label: string;
  details: string;
  /** מסגרת כפריט אחד */
  isSeriesGroup: boolean;
  seriesName: string | null;
};

/** שיעור בודד במסך «שיעורים». */
export type LessonsScreenLesson = {
  id: string;
  time: string;
  label: string;
  details: string;
};

/** בלוק במסך שיעורים: מסגרת עם כמה קוביות, או שיעור עצמאי. */
export type LessonsScreenBlock = {
  id: string;
  kind: "series" | "standalone";
  title: string | null;
  subtitle: string | null;
  lessons: LessonsScreenLesson[];
};

/** יום במסך שיעורים. */
export type LessonsScreenDay = {
  iso: string;
  dayLabel: string;
  blocks: LessonsScreenBlock[];
};
