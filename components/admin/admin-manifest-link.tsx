"use client";

import { useEffect } from "react";

const ADMIN_MANIFEST = "/admin.webmanifest";

/**
 * מבטיח שבדפי /admin מקושר ה-manifest של הניהול (לא ה-manifest הראשי של האתר).
 * Next לפעמים משאיר את קישור ה-manifest של ה-root — ואז Android יוצר קיצור לדף הנוכחי.
 */
export function AdminManifestLink() {
  useEffect(() => {
    const head = document.head;
    const links = Array.from(head.querySelectorAll('link[rel="manifest"]'));
    for (const link of links) {
      if (link.getAttribute("href") !== ADMIN_MANIFEST) {
        link.parentElement?.removeChild(link);
      }
    }
    if (!head.querySelector(`link[rel="manifest"][href="${ADMIN_MANIFEST}"]`)) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = ADMIN_MANIFEST;
      head.appendChild(link);
    }
  }, []);

  return null;
}
