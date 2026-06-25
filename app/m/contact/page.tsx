import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";

export default function MobileContactPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur">
        <Link href="/" aria-label="חזרה" className="text-slate-500">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <span className="text-base font-bold">צור קשר</span>
      </header>

      <main className="flex-1 px-4 py-6">
        <p className="mb-5 text-sm text-slate-500">לשאלות, תמיכה או בקשות שיפור אפשר לפנות אלינו:</p>

        <div className="space-y-3">
          <a
            href="tel:+972500000000"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Phone className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm text-slate-500">טלפון</span>
              <span className="block text-base font-semibold">050-000-0000</span>
            </span>
          </a>

          <a
            href="mailto:info@example.com"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Mail className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm text-slate-500">דוא״ל</span>
              <span className="block text-base font-semibold">info@example.com</span>
            </span>
          </a>
        </div>
      </main>
    </div>
  );
}
