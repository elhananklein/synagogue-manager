"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildDisplayHref, getPreferredSynagogue } from "@/lib/mobile-synagogue-preference";

/** בכניסה לדף הבית במובייל — מפנה ישירות לבית הכנסת השמור (אלא אם `?pick=1`). */
export function MobileHomeRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("pick") === "1") return;
    const pref = getPreferredSynagogue();
    if (!pref) return;
    router.replace(buildDisplayHref(pref));
  }, [router, searchParams]);

  return null;
}
