import { Mail, Phone } from "lucide-react";

export default function ContactPage() {
  return (
    <main className="container py-10">
      <section className="mx-auto max-w-2xl rounded-xl border bg-card p-6 text-right shadow-sm md:p-8">
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">צור קשר</h1>
        <p className="mb-6 text-muted-foreground">לשאלות, תמיכה או בקשות שיפור אפשר לפנות אלינו באחת הדרכים הבאות.</p>

        <div className="space-y-3 text-base">
          <div className="flex items-center justify-start gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <a href="mailto:info@example.com" className="hover:underline">
              info@example.com
            </a>
          </div>
          <div className="flex items-center justify-start gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <a href="tel:+972500000000" className="hover:underline">
              050-000-0000
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
