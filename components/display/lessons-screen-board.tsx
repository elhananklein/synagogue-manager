import { cn } from "@/lib/utils";
import type { LessonsScreenBlock, LessonsScreenDay, LessonsScreenLesson } from "@/lib/lessons-types";

function groupLessonsByTime(lessons: LessonsScreenLesson[]): LessonsScreenLesson[][] {
  const rows: LessonsScreenLesson[][] = [];
  let currentTime: string | null = null;
  let currentRow: LessonsScreenLesson[] = [];
  for (const lesson of lessons) {
    if (currentTime == null || lesson.time !== currentTime) {
      if (currentRow.length) rows.push(currentRow);
      currentTime = lesson.time;
      currentRow = [lesson];
    } else {
      currentRow.push(lesson);
    }
  }
  if (currentRow.length) rows.push(currentRow);
  return rows;
}

function LessonTile({
  lesson,
  compact
}: {
  lesson: LessonsScreenLesson;
  compact?: boolean;
}) {
  return (
    <article className={cn("display-lessons-tile", compact && "display-lessons-tile--compact")}>
      <span className="display-lessons-tile-time">{lesson.time}</span>
      <div className="display-lessons-tile-copy">
        <h3 className="display-lessons-tile-title">{lesson.label}</h3>
        {lesson.details ? <p className="display-lessons-tile-details">{lesson.details}</p> : null}
      </div>
    </article>
  );
}

function LessonsBlock({ block }: { block: LessonsScreenBlock }) {
  const rows = groupLessonsByTime(block.lessons);
  const inner = (
    <div className="display-lessons-block-body">
      {rows.map((row) => (
        <div
          key={row.map((l) => l.id).join("|")}
          className={cn("display-lessons-row", row.length > 1 && "display-lessons-row--parallel")}
        >
          {row.map((lesson) => (
            <LessonTile key={lesson.id} lesson={lesson} compact={row.length > 1} />
          ))}
        </div>
      ))}
    </div>
  );

  if (block.kind === "series") {
    return (
      <section className="display-lessons-frame">
        <header className="display-lessons-frame-header">
          <h2 className="display-lessons-frame-title">{block.title}</h2>
          {block.subtitle ? <p className="display-lessons-frame-subtitle">{block.subtitle}</p> : null}
        </header>
        {inner}
      </section>
    );
  }

  return <div className="display-lessons-standalone">{inner}</div>;
}

export function LessonsScreenBoard({
  days,
  variant = "wall",
  emptyText = "אין שיעורים קרובים."
}: {
  days: LessonsScreenDay[];
  variant?: "wall" | "mobile";
  emptyText?: string;
}) {
  if (!days.length) {
    return <p className="display-lessons-empty">{emptyText}</p>;
  }

  return (
    <div className={cn("display-lessons-board", variant === "mobile" && "display-lessons-board--mobile")}>
      {days.map((day) => (
        <section key={day.iso} className="display-lessons-day">
          <h2 className="display-lessons-day-title">{day.dayLabel}</h2>
          <div className="display-lessons-day-blocks">
            {day.blocks.map((block) => (
              <LessonsBlock key={block.id} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
