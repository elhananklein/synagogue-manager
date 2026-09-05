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

const shots = [
  {
    name: "wall-main",
    url: `${base}/display?synagogueId=${synagogueId}&minyan=1`,
    width: 1920,
    height: 1080,
    fullPage: false,
    waitMs: 8000
  },
  {
    name: "mobile-display",
    url: `${base}/m/display?synagogueId=${synagogueId}&minyan=1`,
    width: 390,
    height: 844,
    fullPage: true,
    waitMs: 8000
  },
  {
    name: "mobile-home",
    url: `${base}/m?pick=1`,
    width: 390,
    height: 844,
    fullPage: true,
    waitMs: 4000
  },
  {
    name: "wall-next",
    url: `${base}/display?synagogueId=${synagogueId}&minyan=1`,
    width: 1920,
    height: 1080,
    fullPage: false,
    waitMs: 24000
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
    await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 1 });
    await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.addStyleTag({
      content: "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}"
    });
    await new Promise((resolve) => setTimeout(resolve, shot.waitMs));
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: shot.fullPage, type: "png" });
    console.log("wrote", file);
    await page.close();
  }
} finally {
  await browser.close();
}
