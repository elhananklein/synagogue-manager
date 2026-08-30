import { Mail, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";
import { RedirectHandheldToMobile } from "@/components/mobile/redirect-handheld-to-mobile";

export default function ContactPage() {
  return (
    <main className="container py-10">
      <RedirectHandheldToMobile />
      <section className="mx-auto max-w-2xl rounded-xl border bg-card p-6 text-right shadow-sm md:p-8">
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">צור קשר</h1>
        <p className="mb-6 text-muted-foreground">לשאלות, תמיכה או בקשות שיפור אפשר לפנות אלינו באחת הדרכים הבאות.</p>

        <div className="mb-8 space-y-3 text-base">
          <div className="flex items-center justify-start gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <a href="mailto:synagogues.manager@gmail.com" className="hover:underline">
              synagogues.manager@gmail.com
            </a>
          </div>
          <div className="flex items-center justify-start gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <a href="tel:+972526480000" className="hover:underline">
              052-6480000
            </a>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h2 className="mb-3 text-lg font-semibold">שלחו לנו הודעה</h2>
          <ContactForm />
        </div>
      </section>
    </main>
  );
}
