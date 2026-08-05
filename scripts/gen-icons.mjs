import sharp from "sharp";

const ICONS = "public/icons";

/** מקור האייקון הציבורי: PNG שאושר (לא SVG). */
async function fromMaster() {
  const src = `${ICONS}/icon-master.png`;
  await sharp(src).resize(192, 192, { fit: "cover" }).png().toFile(`${ICONS}/icon-192.png`);
  await sharp(src).resize(512, 512, { fit: "cover" }).png().toFile(`${ICONS}/icon-512.png`);
  await sharp(src)
    .resize(180, 180, { fit: "cover" })
    .flatten({ background: "#DBEAFE" })
    .png()
    .toFile(`${ICONS}/apple-touch-icon.png`);
}

async function adminIcons() {
  const src = `${ICONS}/admin-icon.png`;
  const bg = "#DBEAFE";
  await sharp(src).resize(192, 192, { fit: "cover" }).png().toFile(`${ICONS}/admin-icon-192.png`);
  await sharp(src).resize(512, 512, { fit: "cover" }).png().toFile(`${ICONS}/admin-icon-512.png`);
  await sharp(src)
    .resize(180, 180, { fit: "cover" })
    .flatten({ background: bg })
    .png()
    .toFile(`${ICONS}/admin-apple-touch-icon.png`);
  const inner = await sharp(src).resize(400, 400, { fit: "contain", background: bg }).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: bg } })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(`${ICONS}/admin-icon-maskable-512.png`);
}

await fromMaster();
await adminIcons();
console.log("done");
