import type { Metadata, Viewport } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";

import { PwaMobileShell } from "@/components/mobile/pwa-install";
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
  description: "מערכת ניהול לבית כנסת - זמני תפילה, הלכה יומית וניהול קהילה",
  applicationName: "מערכת בתי כנסת",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "בתי כנסת"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={frankRuhl.variable}>
      <body className={heebo.className}>
        <PwaMobileShell />
        {children}
      </body>
    </html>
  );
}
