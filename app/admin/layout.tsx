import type { Metadata } from "next";

/**
 * מטא-דאטה נפרד לאזור הניהול — מאפשר להתקין את ממשק הניהול כאפליקציה נפרדת
 * (אייקון ושם משלה) לצד אפליקציית התצוגה, גם באנדרואיד וגם באייפון.
 */
export const metadata: Metadata = {
  applicationName: "ניהול בתי כנסת",
  title: "ניהול בתי כנסת",
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ניהול"
  },
  icons: {
    icon: [
      { url: "/icons/admin-icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/admin-icon.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/admin-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
