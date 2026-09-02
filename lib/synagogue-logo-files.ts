import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { SynagogueIconSize } from "@/lib/synagogue-logo";

const CREAM = { r: 243, g: 234, b: 216, alpha: 1 };

export function synagogueLogoAbsDir(synagogueId: string) {
  return path.join(process.cwd(), "public", "uploads", "logos", synagogueId);
}

export function synagogueLogoPublicUrl(synagogueId: string) {
  return `/uploads/logos/${synagogueId}/icon-512.png`;
}

function iconFileName(size: SynagogueIconSize) {
  if (size === "maskable") return "icon-maskable-512.png";
  if (size === "watermark") return "watermark.png";
  return `icon-${size}.png`;
}

function fallbackRelPath(size: SynagogueIconSize) {
  if (size === "watermark") return null;
  if (size === "180") return path.join("public", "icons", "apple-touch-icon.png");
  return path.join("public", "icons", size === "maskable" ? "icon-512.png" : `icon-${size}.png`);
}

async function squarePng(input: Buffer, size: number) {
  return sharp(input)
    .resize(size, size, { fit: "contain", background: CREAM, withoutEnlargement: false })
    .png()
    .toBuffer();
}

async function transparentSquarePng(input: Buffer, size: number) {
  return sharp(input)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false })
    .png()
    .toBuffer();
}

async function maskablePng(input: Buffer, size: number) {
  const inner = Math.round(size * 0.8);
  const logo = await sharp(input)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: CREAM }
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

export async function writeSynagoguePwaIcons(synagogueId: string, source: Buffer) {
  const dir = synagogueLogoAbsDir(synagogueId);
  await mkdir(dir, { recursive: true });
  const [icon180, icon192, icon512, maskable, watermark] = await Promise.all([
    squarePng(source, 180),
    squarePng(source, 192),
    squarePng(source, 512),
    maskablePng(source, 512),
    transparentSquarePng(source, 512)
  ]);
  await Promise.all([
    writeFile(path.join(dir, "icon-180.png"), icon180),
    writeFile(path.join(dir, "icon-192.png"), icon192),
    writeFile(path.join(dir, "icon-512.png"), icon512),
    writeFile(path.join(dir, "icon-maskable-512.png"), maskable),
    writeFile(path.join(dir, "watermark.png"), watermark),
    writeFile(path.join(dir, "original"), source)
  ]);
}

export async function deleteSynagoguePwaIcons(synagogueId: string) {
  await rm(synagogueLogoAbsDir(synagogueId), { recursive: true, force: true });
}

export async function readSynagogueIconPng(synagogueId: string, size: SynagogueIconSize): Promise<Buffer> {
  const dir = synagogueLogoAbsDir(synagogueId);
  const customPath = path.join(dir, iconFileName(size));
  try {
    return await readFile(customPath);
  } catch {
    if (size === "watermark") {
      try {
        const original = await readFile(path.join(dir, "original"));
        return await transparentSquarePng(original, 512);
      } catch {
        throw new Error("no_watermark");
      }
    }
    const fallback = fallbackRelPath(size);
    if (!fallback) throw new Error("no_icon");
    return readFile(path.join(process.cwd(), fallback));
  }
}
