"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import "./wall-preview.css";

export function WallPreviewFrame({ backHref }: { backHref: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("preview", "wall");
    url.searchParams.set("embed", "1");
    setSrc(url.toString());
  }, []);

  useEffect(() => {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: "landscape" | "portrait") => Promise<void>;
      unlock?: () => void;
    };
    void orientation.lock?.("landscape").catch(() => {});
    return () => {
      try {
        orientation.unlock?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <div className="wall-preview">
      <Link href={backHref} className="wall-preview-back">
        <ArrowRight className="h-4 w-4" aria-hidden />
        חזרה לניהול
      </Link>
      <p className="wall-preview-hint">תצוגת קיר — סובבו לרוחב אם התצוגה צפופה</p>
      <div className="wall-preview-stage">
        {src ? <iframe className="wall-preview-iframe" src={src} title="תצוגת קיר" allow="fullscreen" /> : null}
      </div>
    </div>
  );
}
