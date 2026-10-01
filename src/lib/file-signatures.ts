/**
 * File-signature (magic-byte) validation for uploads.
 *
 * The declared MIME type is client-controlled; these helpers verify the file's
 * actual content before it is accepted, so a script renamed to `.png` with an
 * `image/png` content type is rejected.
 */

export type ImageMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** Canonicalise loose variants (browsers send `image/jpg` for JPEGs). */
export function canonicalImageType(mime: string): string {
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function asciiAt(bytes: Uint8Array, text: string, offset = 0): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** Detect the image type from leading bytes; null when unrecognised. */
export function sniffImageType(bytes: Uint8Array): ImageMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (asciiAt(bytes, "GIF87a") || asciiAt(bytes, "GIF89a")) return "image/gif";
  if (asciiAt(bytes, "RIFF") && asciiAt(bytes, "WEBP", 8)) return "image/webp";
  return null;
}

/** True when the buffer's signature matches the declared (client) MIME type. */
export function matchesDeclaredType(bytes: Uint8Array, declaredMime: string): boolean {
  const sniffed = sniffImageType(bytes);
  if (!sniffed) return false;
  return sniffed === canonicalImageType(declaredMime);
}
