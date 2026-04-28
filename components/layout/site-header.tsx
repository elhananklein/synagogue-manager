import Link from "next/link";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/#halacha", label: "הלכה יומית" },
  { href: "/contact", label: "צור קשר" }
];

export async function SiteHeader() {
  return (
    <header className="border-b border-border bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">מערכת ניהול לבתי כנסת</span>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-muted-foreground transition hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <Button asChild variant="outline" size="sm">
          <Link href="/admin">כניסה לממשק ניהול</Link>
        </Button>
      </div>
    </header>
  );
}
