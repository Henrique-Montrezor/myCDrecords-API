import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

export type ProfileImageKind = "avatar" | "banner";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PROFILE_DIR = path.join(UPLOADS_DIR, "profile");
const PUBLIC_PREFIX = "/uploads/profile/";
const FILE_NAME = /^(avatar|banner)-\d+-[0-9a-f]{16}\.(jpg|png|webp)$/;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Trust the file signature, never the client-declared type.
export function detectImageType(buffer: Buffer): "jpg" | "png" | "webp" | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
    return null;
}

// Stores the image under a random name and returns its public URL.
export async function saveProfileImage(userId: number, kind: ProfileImageKind, buffer: Buffer, ext: string, baseUrl: string) {
    const fileName = `${kind}-${userId}-${randomBytes(8).toString("hex")}.${ext}`;
    await mkdir(PROFILE_DIR, { recursive: true });
    await writeFile(path.join(PROFILE_DIR, fileName), buffer);
    return `${baseUrl}${PUBLIC_PREFIX}${fileName}`;
}

// Deletes a previously uploaded file; external URLs and unknown names are ignored.
export async function removeProfileImage(url: string | null | undefined) {
    if (!url) return;
    let pathname: string;
    try {
        pathname = new URL(url).pathname;
    } catch {
        return;
    }
    if (!pathname.startsWith(PUBLIC_PREFIX)) return;
    const fileName = pathname.slice(PUBLIC_PREFIX.length);
    if (!FILE_NAME.test(fileName)) return;
    await unlink(path.join(PROFILE_DIR, fileName)).catch(() => undefined);
}
