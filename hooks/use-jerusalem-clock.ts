"use client";

import { useEffect, useState } from "react";
import {
  readJerusalemClock,
  subscribeJerusalemClock,
  type JerusalemClockParts
} from "@/lib/jerusalem-clock";

export function useJerusalemClock(): JerusalemClockParts {
  const [parts, setParts] = useState<JerusalemClockParts>(() => readJerusalemClock());

  useEffect(() => subscribeJerusalemClock(setParts), []);

  return parts;
}
