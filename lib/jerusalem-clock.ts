export type JerusalemClockParts = {
  hour: number;
  minute: number;
  second: number;
};

export type JerusalemClockSweep = JerusalemClockParts & {
  ms: number;
};

export function readJerusalemClock(now = new Date()): JerusalemClockParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    hour: num("hour"),
    minute: num("minute"),
    second: num("second")
  };
}

export function readJerusalemSweep(now = new Date()): JerusalemClockSweep {
  return { ...readJerusalemClock(now), ms: now.getMilliseconds() };
}

export function padClock(value: number) {
  return String(value).padStart(2, "0");
}

export function analogHandAngles(sweep: JerusalemClockSweep, smooth: boolean) {
  const frac = smooth ? sweep.ms / 1000 : 0;
  const seconds = sweep.second + frac;
  const minutes = sweep.minute + seconds / 60;
  const hours = (sweep.hour % 12) + minutes / 60;
  return {
    hour: hours * 30,
    minute: minutes * 6,
    second: seconds * 6
  };
}

type TickListener = (parts: JerusalemClockParts) => void;
type SweepListener = (sweep: JerusalemClockSweep) => void;

const tickListeners = new Set<TickListener>();
const sweepListeners = new Set<SweepListener>();
let lastParts: JerusalemClockParts = readJerusalemClock();
let lastSweep: JerusalemClockSweep = readJerusalemSweep();
let lastTickKey = `${lastParts.hour}:${lastParts.minute}:${lastParts.second}`;
let rafId = 0;
let timeoutId = 0;
let intervalId = 0;
let watchdogId = 0;
let lastEmitAt = Date.now();
let mode: "off" | "interval" | "raf" = "off";

function partsKey(parts: JerusalemClockParts) {
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

function emitSweep(now = new Date()) {
  lastEmitAt = Date.now();
  lastSweep = readJerusalemSweep(now);
  lastParts = lastSweep;
  sweepListeners.forEach((listener) => listener(lastSweep));
  const key = partsKey(lastParts);
  if (key !== lastTickKey) {
    lastTickKey = key;
    tickListeners.forEach((listener) => listener(lastParts));
  }
}

function emitTick(now = new Date()) {
  lastEmitAt = Date.now();
  lastParts = readJerusalemClock(now);
  lastSweep = { ...lastParts, ms: now.getMilliseconds() };
  const key = partsKey(lastParts);
  if (key !== lastTickKey) {
    lastTickKey = key;
    tickListeners.forEach((listener) => listener(lastParts));
  }
}

function stopAll() {
  if (typeof window === "undefined") return;
  window.cancelAnimationFrame(rafId);
  window.clearTimeout(timeoutId);
  window.clearInterval(intervalId);
  rafId = 0;
  timeoutId = 0;
  intervalId = 0;
  mode = "off";
}

function startRaf() {
  if (typeof window === "undefined" || mode === "raf") return;
  stopAll();
  mode = "raf";
  startWatchdog();
  const loop = () => {
    emitSweep();
    rafId = window.requestAnimationFrame(loop);
  };
  rafId = window.requestAnimationFrame(loop);
}

function startWatchdog() {
  if (typeof window === "undefined" || watchdogId) return;
  watchdogId = window.setInterval(() => {
    if (mode === "off") return;
    if (Date.now() - lastEmitAt < 4000) return;
    stopAll();
    syncEngine();
    emitTick();
  }, 3000);
}

function onClockVisible() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  lastEmitAt = 0;
  emitTick();
  if (mode === "off") return;
  stopAll();
  syncEngine();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onClockVisible);
  window.addEventListener("focus", onClockVisible);
  window.addEventListener("pageshow", onClockVisible);
}

function startInterval() {
  if (typeof window === "undefined" || mode === "interval") return;
  stopAll();
  mode = "interval";
  startWatchdog();
  emitTick();
  timeoutId = window.setTimeout(() => {
    emitTick();
    intervalId = window.setInterval(() => emitTick(), 1000);
  }, 1000 - (Date.now() % 1000));
}

function syncEngine() {
  if (sweepListeners.size) startRaf();
  else if (tickListeners.size) startInterval();
  else stopAll();
}

export function subscribeJerusalemClock(listener: TickListener) {
  tickListeners.add(listener);
  listener(lastParts);
  syncEngine();
  return () => {
    tickListeners.delete(listener);
    syncEngine();
  };
}

export function subscribeJerusalemSweep(listener: SweepListener) {
  sweepListeners.add(listener);
  listener(lastSweep);
  syncEngine();
  return () => {
    sweepListeners.delete(listener);
    syncEngine();
  };
}
