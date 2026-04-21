import type { Metadata } from "next";
import { Heebo } from "next/font/google";

import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "בית כנסת בית רימון",
  description: "מערכת ניהול לבית כנסת - זמני תפילה, הלכה יומית וניהול קהילה"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body className={heebo.className}>{children}</body>
    </html>
  );
}
