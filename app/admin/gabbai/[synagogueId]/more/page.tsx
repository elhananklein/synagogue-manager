import Link from "next/link";
import { Monitor, Settings, Tv, Users } from "lucide-react";

export default async function GabbaiMorePage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = await params;
  const base = `/admin/gabbai/${encodeURIComponent(synagogueId)}`;

  return (
    <>
      <h1 className="gabbai-lead">עוד פעולות</h1>
      <p className="gabbai-hint">הגדרות שמשנים לעיתים רחוקות יותר.</p>
      <div className="gabbai-task-grid">
        <Link href={`${base}/congregants`} className="gabbai-task-card">
          <span className="gabbai-task-icon">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <h2>מתפללים</h2>
            <p>כרטיס מתפלל, מניין, וייבוא מאקסל</p>
          </span>
        </Link>
        <Link href={`${base}/look`} className="gabbai-task-card">
          <span className="gabbai-task-icon">
            <Monitor className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <h2>מראה המסך</h2>
            <p>סגנון, צבעים, פונט ומסכים מתחלפים</p>
          </span>
        </Link>
        <Link href={`${base}/settings`} className="gabbai-task-card">
          <span className="gabbai-task-icon">
            <Settings className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <h2>הגדרות בית הכנסת</h2>
            <p>שם, מניינים והלכה יומית</p>
          </span>
        </Link>
        <a href={`/display?synagogueId=${encodeURIComponent(synagogueId)}`} className="gabbai-task-card">
          <span className="gabbai-task-icon">
            <Tv className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <h2>צפייה במסך</h2>
            <p>לראות איך התצוגה נראית עכשיו</p>
          </span>
        </a>
      </div>
    </>
  );
}
