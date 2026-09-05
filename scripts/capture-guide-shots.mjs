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

const shots = [
  {
    name: "wall-main",
    url: `${base}/display?synagogueId=${synagogueId}&minyan=1`,
    width: 1920,
    height: 1080,
    mobile: false,
    waitFor: ".display-header",
    waitMs: 4000
  },
  {
    name: "wall-next",
    url: `${base}/display?synagogueId=${synagogueId}&minyan=1`,
    width: 1920,
    height: 1080,
    mobile: false,
    waitFor: ".display-header",
    waitMs: 4000,
    advanceScreens: 1
  },
  {
    name: "mobile-display",
    url: `${base}/m/display?synagogueId=${synagogueId}&minyan=1&preview=mobile`,
    width: 390,
    height: 844,
    mobile: true,
    waitFor: ".m-shell",
    waitMs: 5000
  },
  {
    name: "mobile-home",
    url: `${base}/m?pick=1`,
    width: 390,
    height: 844,
    mobile: true,
    waitFor: ".m-shell",
    waitMs: 3000
  }
];

const browser = await puppeteer.launch({
  executablePath: edge,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"]
});

try {
  for (const shot of shots) {
    const page = await browser.newPage();
    if (shot.mobile) {
      await page.setUserAgent(iphoneUa);
      await page.setViewport({
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      });
    } else {
      await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 1 });
    }
    await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: hideChrome });
    await page.waitForSelector(shot.waitFor, { timeout: 90000 });
    if (shot.mobile) {
      const path = new URL(page.url()).pathname;
      if (!path.startsWith("/m")) {
        throw new Error(`${shot.name}: expected /m URL, got ${page.url()}`);
      }
      const hasWall = await page.$(".display-header");
      if (hasWall) {
        throw new Error(`${shot.name}: wall chrome appeared on a mobile shot`);
      }
    }
    if (shot.advanceScreens) {
      for (let i = 0; i < shot.advanceScreens; i++) {
        await page.keyboard.press("ArrowLeft");
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    if (shot.mobile && shot.name === "mobile-display") {
      await page.evaluate(() => {
        const next = document.querySelector(".m-viewport .m-section:nth-of-type(2)");
        next?.scrollIntoView({ block: "start" });
      });
    }
    await new Promise((r) => setTimeout(r, shot.waitMs));
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: false, type: "png" });
    console.log("wrote", file, page.url());
    await page.close();
  }
} finally {
  await browser.close();
}
