"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CalendarDays, Home, Megaphone, Settings, Sun } from "lucide-react";
import { LogoutButton } from "@/components/admin/logout-button";

const NAV = [
  { href: "", label: "ראשי", Icon: Home },
  { href: "/prayers", label: "תפילות", Icon: CalendarDays },
  { href: "/bulletin", label: "מודעות", Icon: Megaphone },
  { href: "/shabbat", label: "שבת", Icon: Sun },
  { href: "/more", label: "עוד", Icon: Settings }
] as const;

function navHref(synagogueId: string, suffix: string) {
  return `/admin/gabbai/${encodeURIComponent(synagogueId)}${suffix}`;
}

export function GabbaiShell({
  synagogueId,
  synagogueName,
  children
}: {
  synagogueId: string;
  synagogueName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/admin/gabbai/${synagogueId}`;
  const homeHref = navHref(synagogueId, "");
  const isHome = pathname === base;

  return (
    <div className="gabbai-shell">
      <header className="gabbai-top">
        {isHome ? null : (
          <Link href={homeHref} className="gabbai-back-top" aria-label="חזרה למסך הראשי">
            <ArrowRight className="h-5 w-5" aria-hidden />
            <span>חזרה</span>
          </Link>
        )}
        <h1>{synagogueName || "בית הכנסת"}</h1>
        <LogoutButton className="gabbai-logout" />
      </header>
      <nav className="gabbai-nav gabbai-nav--top" aria-label="ניהול">
        {NAV.map(({ href, label, Icon }) => {
          const to = navHref(synagogueId, href);
          const current =
            href === ""
              ? pathname === base
              : href === "/more"
                ? pathname.startsWith(`${base}/more`) ||
                  pathname.startsWith(`${base}/look`) ||
                  pathname.startsWith(`${base}/settings`)
                : pathname.startsWith(base + href);
          return (
            <Link key={href || "home"} href={to} aria-current={current ? "page" : undefined}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="gabbai-body">
        {isHome ? null : (
          <Link href={homeHref} className="gabbai-back">
            <ArrowRight className="h-5 w-5" aria-hidden />
            חזרה למסך הראשי
          </Link>
        )}
        {children}
      </div>
      <nav className="gabbai-nav gabbai-nav--bottom" aria-label="ניהול">
        {NAV.map(({ href, label, Icon }) => {
          const to = navHref(synagogueId, href);
          const current =
            href === ""
              ? pathname === base
              : href === "/more"
                ? pathname.startsWith(`${base}/more`) ||
                  pathname.startsWith(`${base}/look`) ||
                  pathname.startsWith(`${base}/settings`)
                : pathname.startsWith(base + href);
          return (
            <Link key={`m-${href || "home"}`} href={to} aria-current={current ? "page" : undefined}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
