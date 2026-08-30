import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";

export default function MobileContactPage() {
  return (
    <div className="m-shell">
      <header className="m-header m-header--simple">
        <Link href="/" aria-label="חזרה" className="text-[#fff8ea]">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <span className="text-base font-extrabold">צור קשר</span>
      </header>

      <main className="m-main">
        <p className="m-lead">לשאלות, תמיכה או בקשות שיפור אפשר לפנות אלינו:</p>

        <div className="mb-6 space-y-3">
          <a href="tel:+972526480000" className="m-contact-row">
            <span className="m-contact-icon">
              <Phone className="h-5 w-5" />
            </span>
            <span>
              <span className="m-tile-label">טלפון</span>
              <span className="m-list-item-title">052-6480000</span>
            </span>
          </a>

          <a href="mailto:synagogues.manager@gmail.com" className="m-contact-row">
            <span className="m-contact-icon">
              <Mail className="h-5 w-5" />
            </span>
            <span>
              <span className="m-tile-label">דוא״ל</span>
              <span className="m-list-item-title">synagogues.manager@gmail.com</span>
            </span>
          </a>
        </div>

        <div className="m-card">
          <h2 className="m-section-title">שלחו לנו הודעה</h2>
          <ContactForm />
        </div>
      </main>
    </div>
  );
}
