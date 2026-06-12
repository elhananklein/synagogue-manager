import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";

import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  display: "swap"
});

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["500", "700", "900"],
  display: "swap",
  variable: "--font-royal"
});

export const metadata: Metadata = {
  title: "בית כנסת בית רימון",
  description: "מערכת ניהול לבית כנסת - זמני תפילה, הלכה יומית וניהול קהילה"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={frankRuhl.variable}>
      <body className={heebo.className}>{children}</body>
    </html>
  );
}
