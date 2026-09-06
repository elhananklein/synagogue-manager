import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { SynagogueIconSize } from "@/lib/synagogue-logo";

const CREAM = { r: 243, g: 234, b: 216, alpha: 1 };
const LOGO_BUCKET = "synagogue-logos";
const ICON_FILES = ["icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "watermark.png", "original"] as const;

export function synagogueLogoAbsDir(synagogueId: string) {
  return path.join(process.cwd(), "public", "uploads", "logos", synagogueId);
}

export function synagogueLogoPublicUrl(synagogueId: string) {
  return `/m/icon/${synagogueId}/512`;
}

export function sniffImageMime(buffer: Buffer, reported?: string | null): "image/jpeg" | "image/png" | "image/webp" | null {
  const type = String(reported ?? "")
    .trim()
    .toLowerCase();
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  if (type === "image/jpeg" || type === "image/png" || type === "image/webp") return type;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
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
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(size, size, { fit: "contain", background: CREAM, withoutEnlargement: false })
    .png()
    .toBuffer();
}

async function transparentSquarePng(input: Buffer, size: number) {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false })
    .png()
    .toBuffer();
}

async function maskablePng(input: Buffer, size: number) {
  const inner = Math.round(size * 0.8);
  const logo = await sharp(input, { failOn: "none" })
    .rotate()
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

async function ensureLogoBucket() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("missing_service_role_key");
  const existing = await supabase.storage.getBucket(LOGO_BUCKET);
  if (existing.data) return supabase;
  const created = await supabase.storage.createBucket(LOGO_BUCKET, {
    public: false,
    fileSizeLimit: "8MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/octet-stream"]
  });
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
    throw new Error(created.error.message);
  }
  return supabase;
}

async function writeLocalIcons(synagogueId: string, files: Array<{ name: string; data: Buffer }>) {
  const dir = synagogueLogoAbsDir(synagogueId);
  try {
    await mkdir(dir, { recursive: true });
    await Promise.all(files.map((file) => writeFile(path.join(dir, file.name), file.data)));
    return true;
  } catch {
    return false;
  }
}

async function writeStorageIcons(synagogueId: string, files: Array<{ name: string; data: Buffer }>) {
  const supabase = await ensureLogoBucket();
  for (const file of files) {
    const contentType = file.name === "original" ? "application/octet-stream" : "image/png";
    const uploaded = await supabase.storage.from(LOGO_BUCKET).upload(`${synagogueId}/${file.name}`, file.data, {
      contentType,
      upsert: true
    });
    if (uploaded.error) throw new Error(uploaded.error.message);
  }
}

export async function writeSynagoguePwaIcons(synagogueId: string, source: Buffer) {
  const [icon180, icon192, icon512, maskable, watermark] = await Promise.all([
    squarePng(source, 180),
    squarePng(source, 192),
    squarePng(source, 512),
    maskablePng(source, 512),
    transparentSquarePng(source, 512)
  ]);
  const files = [
    { name: "icon-180.png", data: icon180 },
    { name: "icon-192.png", data: icon192 },
    { name: "icon-512.png", data: icon512 },
    { name: "icon-maskable-512.png", data: maskable },
    { name: "watermark.png", data: watermark },
    { name: "original", data: source }
  ];
  let storageError: unknown = null;
  try {
    await writeStorageIcons(synagogueId, files);
  } catch (error) {
    storageError = error;
  }
  const wroteLocal = await writeLocalIcons(synagogueId, files);
  if (!wroteLocal && storageError) {
    throw storageError instanceof Error ? storageError : new Error("logo_process_failed");
  }
}

export async function deleteSynagoguePwaIcons(synagogueId: string) {
  await rm(synagogueLogoAbsDir(synagogueId), { recursive: true, force: true }).catch(() => undefined);
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  await supabase.storage
    .from(LOGO_BUCKET)
    .remove(ICON_FILES.map((name) => `${synagogueId}/${name}`))
    .catch(() => undefined);
}

async function readStorageIcon(synagogueId: string, name: string): Promise<Buffer | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const downloaded = await supabase.storage.from(LOGO_BUCKET).download(`${synagogueId}/${name}`);
  if (downloaded.error || !downloaded.data) return null;
  return Buffer.from(await downloaded.data.arrayBuffer());
}

export async function readSynagogueIconPng(synagogueId: string, size: SynagogueIconSize): Promise<Buffer> {
  const dir = synagogueLogoAbsDir(synagogueId);
  const name = iconFileName(size);
  try {
    return await readFile(path.join(dir, name));
  } catch {
    const fromStorage = await readStorageIcon(synagogueId, name);
    if (fromStorage) return fromStorage;
    if (size === "watermark") {
      try {
        const original = await readFile(path.join(dir, "original"));
        return await transparentSquarePng(original, 512);
      } catch {
        const original = await readStorageIcon(synagogueId, "original");
        if (original) return transparentSquarePng(original, 512);
        throw new Error("no_watermark");
      }
    }
    const fallback = fallbackRelPath(size);
    if (!fallback) throw new Error("no_icon");
    return readFile(path.join(process.cwd(), fallback));
  }
}
