import type { Viewport } from "next";

import "./mobile.css";

export const viewport: Viewport = {
  themeColor: "#6b1a2e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <div className="m-app">{children}</div>;
}
