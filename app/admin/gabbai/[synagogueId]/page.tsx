import Link from "next/link";
import { CalendarDays, Megaphone, Monitor, Settings, Sun } from "lucide-react";

export default async function GabbaiHomePage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = await params;
  const base = `/admin/gabbai/${encodeURIComponent(synagogueId)}`;

  const tasks = [
    {
      href: `${base}/prayers`,
      title: "זמני תפילה",
      desc: "לשנות שחרית, מנחה או ערבית — לחול ולשבת",
      Icon: CalendarDays
    },
    {
      href: `${base}/bulletin`,
      title: "לוח מודעות",
      desc: "לפרסם הודעה או תמונה על המסך בבית הכנסת",
      Icon: Megaphone
    },
    {
      href: `${base}/shabbat`,
      title: "סדר שבת",
      desc: "מה קורה בשבת הקרובה, לפי הסדר",
      Icon: Sun
    },
    {
      href: `${base}/look`,
      title: "מראה המסך",
      desc: "צבעים, פונט, ואילו מסכים יוצגו על הקיר",
      Icon: Monitor
    },
    {
      href: `${base}/settings`,
      title: "הגדרות בית הכנסת",
      desc: "שם, מניינים והלכה יומית",
      Icon: Settings
    }
  ];

  return (
    <>
      <h1 className="gabbai-lead">מה תרצו לעדכן?</h1>
      <p className="gabbai-hint">בחרו פעולה. השמירה היא רק למסך שבו אתם נמצאים.</p>
      <div className="gabbai-task-grid">
        {tasks.map(({ href, title, desc, Icon }) => (
          <Link key={href} href={href} className="gabbai-task-card">
            <span className="gabbai-task-icon">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <h2>{title}</h2>
              <p>{desc}</p>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
