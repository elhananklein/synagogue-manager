"use client";

import { useEffect } from "react";
import { isHandheldBrowser, wantsDesktopWallOverride } from "@/lib/handheld";

/**
 * רשת ביטחון: אם ה־SW או מטמון החזירו תצוגת קיר למכשיר נייד — מעבירים ל־/m.
 */
export function RedirectHandheldToMobile() {
  useEffect(() => {
    if (!isHandheldBrowser()) return;
    if (wantsDesktopWallOverride()) return;
    const url = new URL(window.location.href);
    if (url.pathname === "/m" || url.pathname.startsWith("/m/")) return;
    url.pathname = url.pathname === "/" ? "/m" : `/m${url.pathname}`;
    window.location.replace(url.toString());
  }, []);
  return null;
}
