"use client";

import { useEffect } from "react";
import {
  isHandheldBrowser,
  isPhoneBrowser,
  isWallSizedScreen,
  wantsDesktopWallOverride
} from "@/lib/handheld";

/**
 * רשת ביטחון: טלפון שקיבל בטעות תצוגת קיר — מעבירים ל־/m.
 * לא מפנים טלוויזיה, סטיק, או מסך גדול (קיר).
 */
export function RedirectHandheldToMobile({ wallPath = false }: { wallPath?: boolean }) {
  useEffect(() => {
    if (wantsDesktopWallOverride()) return;
    if (isWallSizedScreen()) return;
    const shouldLeave = wallPath ? isPhoneBrowser() : isHandheldBrowser();
    if (!shouldLeave) return;
    const url = new URL(window.location.href);
    if (url.pathname === "/m" || url.pathname.startsWith("/m/")) return;
    url.pathname = url.pathname === "/" ? "/m" : `/m${url.pathname}`;
    window.location.replace(url.toString());
  }, [wallPath]);
  return null;
}
