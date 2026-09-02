"use client";

import { useEffect } from "react";
import { synagogueIconSrc } from "@/lib/synagogue-logo";

/**
 * מחליף את קישור ה-manifest של ה-root במניפסט של בית הכנסת —
 * כדי ש-Android ייצור אפליקציה עם start_url, שם ואייקון נכונים.
 */
export function PublicSynagogueManifestLink({ synagogueId }: { synagogueId: string | null }) {
  useEffect(() => {
    const id = synagogueId?.trim().toLowerCase();
    if (!id) return;
    const href = `/m/manifest/${id}`;
    const head = document.head;
    const links = Array.from(head.querySelectorAll('link[rel="manifest"]'));
    for (const link of links) {
      if (link.getAttribute("href") !== href) {
        link.parentElement?.removeChild(link);
      }
    }
    if (!head.querySelector(`link[rel="manifest"][href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = href;
      head.appendChild(link);
    }

    const appleHref = synagogueIconSrc(id, "180");
    const appleLinks = Array.from(head.querySelectorAll('link[rel="apple-touch-icon"]'));
    for (const link of appleLinks) {
      if (link.getAttribute("href") !== appleHref) {
        link.parentElement?.removeChild(link);
      }
    }
    if (!head.querySelector(`link[rel="apple-touch-icon"][href="${appleHref}"]`)) {
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      link.setAttribute("sizes", "180x180");
      link.href = appleHref;
      head.appendChild(link);
    }
  }, [synagogueId]);

  return null;
}
