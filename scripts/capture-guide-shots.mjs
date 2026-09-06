import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "guide");
mkdirSync(outDir, { recursive: true });

const edge =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const base = process.env.GUIDE_BASE_URL || "http://localhost:3000";
const synagogueId = process.env.GUIDE_SYNAGOGUE_ID || "synagogue-test";
const iphoneUa =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const hideChrome =
  "nextjs-portal,[data-nextjs-toast],#__next-build-watcher,.m-pwa{display:none!important}";

const wallUrl = `${base}/display?synagogueId=${synagogueId}&minyan=1`;
const mobileUrl = `${base}/m/display?synagogueId=${synagogueId}&minyan=1&preview=mobile`;

const wallShots = [
  { name: "wall-home", seek: ".display-main-grid" },
  { name: "wall-info", seek: ".display-info-card" },
  { name: "wall-main", seek: ".display-datetime-screen" },
  { name: "wall-omer", seek: ".display-omer-line", optional: true },
  { name: "wall-next", seek: ".display-halacha-title" },
  { name: "wall-learning", seek: ".display-daily-learning-title" },
  { name: "wall-prayers", seek: ".display-prayer-times-card" },
  { name: "wall-schedule", seek: ".display-full-schedule-card" },
  { name: "wall-bulletin", seek: ".display-bulletin-screen" },
  { name: "wall-shabbat", seek: ".display-shabbat-screen", friday: true }
];

async function seekWallScreen(page, selector) {
  for (let i = 0; i < 16; i++) {
    if (await page.$(selector)) return true;
    const clicked = await page.evaluate(() => {
      const next = document.querySelector(".display-nav-edge--next");
      if (!next) return false;
      next.click();
      return true;
    });
    if (!clicked) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
  return Boolean(await page.$(selector));
}

const browser = await puppeteer.launch({
  executablePath: edge,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"]
});

try {
  for (const shot of wallShots) {
    const page = await browser.newPage();
    if (shot.friday) {
      await page.evaluateOnNewDocument(() => {
        const frozen = new Date("2026-09-11T12:00:00+03:00").getTime();
        const RealDate = Date;
        function FakeDate(...args) {
          if (args.length === 0) return new RealDate(frozen);
          return new RealDate(...args);
        }
        FakeDate.now = () => frozen;
        FakeDate.parse = RealDate.parse;
        FakeDate.UTC = RealDate.UTC;
        FakeDate.prototype = RealDate.prototype;
        Date = FakeDate;
      });
    }
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    const url = shot.friday ? `${wallUrl}&date=2026-09-11` : wallUrl;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: hideChrome });
    await page.waitForSelector(".display-header", { timeout: 90000 });
    const found = await seekWallScreen(page, shot.seek);
    if (!found) {
      if (shot.optional) {
        console.log("skip", shot.name);
        await page.close();
        continue;
      }
      throw new Error(`did not reach ${shot.seek} for ${shot.name}`);
    }
    await new Promise((r) => setTimeout(r, 1800));
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: false, type: "png" });
    console.log("wrote", file);
    await page.close();
  }

  const mobile = await browser.newPage();
  await mobile.setUserAgent(iphoneUa);
  await mobile.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  await mobile.goto(mobileUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mobile.addStyleTag({ content: hideChrome });
  await mobile.waitForSelector(".m-shell", { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  const mobileFile = join(outDir, "mobile-full.png");
  await mobile.screenshot({ path: mobileFile, fullPage: true, type: "png" });
  console.log("wrote", mobileFile);
  await mobile.close();
} finally {
  await browser.close();
}
