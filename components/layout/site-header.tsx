import Link from "next/link";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const navItems = [
  { href: "#zmanim", label: "זמני תפילה" },
  { href: "#halacha", label: "הלכה יומית" },
  { href: "#contact", label: "יצירת קשר" }
];

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">בית כנסת בית רימון</span>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-muted-foreground transition hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <Button asChild variant="outline" size="sm">
          <Link href="/admin">כניסת גבאים</Link>
        </Button>
      </div>
    </header>
  );
}
