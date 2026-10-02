import Link from "next/link";

export function AliyahSubnav({ synagogueId, active }: { synagogueId: string; active: "record" | "plan" }) {
  const base = `/admin/gabbai/${encodeURIComponent(synagogueId)}/aliyot`;
  return (
    <nav className="aliyah-subnav" aria-label="עליות">
      <Link href={`${base}/plan`} className={active === "plan" ? "is-active" : undefined} aria-current={active === "plan" ? "page" : undefined}>
        תכנון לשבת הקרובה
      </Link>
      <Link href={base} className={active === "record" ? "is-active" : undefined} aria-current={active === "record" ? "page" : undefined}>
        רישום מי עלה
      </Link>
    </nav>
  );
}
