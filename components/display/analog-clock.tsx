"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  analogHandAngles,
  readJerusalemSweep,
  subscribeJerusalemSweep
} from "@/lib/jerusalem-clock";

const CARDINAL = [
  { label: "12", x: 100, y: 36 },
  { label: "3", x: 164, y: 102 },
  { label: "6", x: 100, y: 168 },
  { label: "9", x: 36, y: 102 }
] as const;

export function AnalogClock({ className }: { className?: string }) {
  const reactId = useId().replace(/:/g, "");
  const faceGradId = `ac-face-${reactId}`;
  const hourRef = useRef<SVGGElement | null>(null);
  const minuteRef = useRef<SVGGElement | null>(null);
  const secondRef = useRef<SVGGElement | null>(null);
  const [initial] = useState(() => analogHandAngles(readJerusalemSweep(), false));

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return subscribeJerusalemSweep((sweep) => {
      const next = analogHandAngles(sweep, !reduceMotion);
      hourRef.current?.setAttribute("transform", `rotate(${next.hour} 100 100)`);
      minuteRef.current?.setAttribute("transform", `rotate(${next.minute} 100 100)`);
      secondRef.current?.setAttribute("transform", `rotate(${next.second} 100 100)`);
    });
  }, []);

  return (
    <div className={cn("display-analog-clock", className)}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <radialGradient id={faceGradId} cx="38%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
          </radialGradient>
        </defs>

        <circle className="display-analog-clock-bezel" cx="100" cy="100" r="98" />
        <circle className="display-analog-clock-face" cx="100" cy="100" r="91.5" />
        <circle cx="100" cy="100" r="91.5" fill={`url(#${faceGradId})`} />
        <circle className="display-analog-clock-ring" cx="100" cy="100" r="83" />

        {Array.from({ length: 12 }, (_, index) => {
          if (index % 3 === 0) return null;
          return (
            <rect
              key={index}
              className="display-analog-clock-tick"
              x="98.35"
              y="16.5"
              width="3.3"
              height="11"
              rx="1.65"
              transform={`rotate(${index * 30} 100 100)`}
            />
          );
        })}

        {CARDINAL.map((item) => (
          <text key={item.label} className="display-analog-clock-numeral" x={item.x} y={item.y}>
            {item.label}
          </text>
        ))}

        <g ref={hourRef} transform={`rotate(${initial.hour} 100 100)`}>
          <rect className="display-analog-clock-hand display-analog-clock-hand--hour" x="95.1" y="48" width="9.8" height="62" rx="4.9" />
        </g>
        <g ref={minuteRef} transform={`rotate(${initial.minute} 100 100)`}>
          <rect className="display-analog-clock-hand display-analog-clock-hand--minute" x="97.15" y="24" width="5.7" height="82" rx="2.85" />
        </g>
        <g ref={secondRef} transform={`rotate(${initial.second} 100 100)`}>
          <line className="display-analog-clock-hand display-analog-clock-hand--second" x1="100" y1="124" x2="100" y2="27" />
          <circle className="display-analog-clock-hand display-analog-clock-hand--second" cx="100" cy="24.5" r="4.1" />
          <circle className="display-analog-clock-second-weight" cx="100" cy="118" r="2.3" />
        </g>

        <circle className="display-analog-clock-hub-ring" cx="100" cy="100" r="8.2" />
        <circle className="display-analog-clock-cap" cx="100" cy="100" r="3.6" />
      </svg>
    </div>
  );
}
