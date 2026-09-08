"use client";

import { useEffect, useState } from "react";
import { subscribeJerusalemClock, type JerusalemClockParts } from "@/lib/jerusalem-clock";

export function useJerusalemClock(): JerusalemClockParts | null {
  const [parts, setParts] = useState<JerusalemClockParts | null>(null);

  useEffect(() => subscribeJerusalemClock(setParts), []);

  return parts;
}
