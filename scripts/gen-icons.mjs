import sharp from "sharp";
import { readFile } from "node:fs/promises";

const ICONS = "public/icons";

async function fromSvg() {
  const svg = await readFile(`${ICONS}/icon.svg`);
  await sharp(svg, { density: 512 }).resize(192, 192).png().toFile(`${ICONS}/icon-192.png`);
  await sharp(svg, { density: 512 }).resize(512, 512).png().toFile(`${ICONS}/icon-512.png`);
  // apple-touch-icon: 180px, no transparency (iOS ignores alpha)
  await sharp(svg, { density: 512 })
    .resize(180, 180)
    .flatten({ background: "#059669" })
    .png()
    .toFile(`${ICONS}/apple-touch-icon.png`);
}

async function adminIcons() {
  const src = `${ICONS}/admin-icon.png`;
  await sharp(src).resize(192, 192, { fit: "cover" }).flatten({ background: "#4f46e5" }).png().toFile(`${ICONS}/admin-icon-192.png`);
  await sharp(src).resize(512, 512, { fit: "cover" }).flatten({ background: "#4f46e5" }).png().toFile(`${ICONS}/admin-icon-512.png`);
  // maskable: icon at ~78% on solid theme background so nothing important is cropped
  const inner = await sharp(src).resize(400, 400, { fit: "contain", background: "#4f46e5" }).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#4f46e5" } })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(`${ICONS}/admin-icon-maskable-512.png`);
}

await fromSvg();
await adminIcons();
console.log("done");
