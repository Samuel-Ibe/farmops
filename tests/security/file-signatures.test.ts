import { describe, it, expect } from "vitest";
import {
  canonicalImageType,
  matchesDeclaredType,
  sniffImageType,
} from "@/lib/file-signatures";

/** Build file buffers with genuine signatures. */
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const gif87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00]);
const gif89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00]);
const webp = (() => {
  const b = new Uint8Array(16);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return b;
})();
const pdfSpoof = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]); // %PDF-1
const scriptSpoof = new Uint8Array([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]); // <script
const randomBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

describe("Magic-byte sniffing", () => {
  it("detects genuine image types", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(gif87)).toBe("image/gif");
    expect(sniffImageType(gif89)).toBe("image/gif");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("returns null for non-image content", () => {
    expect(sniffImageType(pdfSpoof)).toBeNull();
    expect(sniffImageType(scriptSpoof)).toBeNull();
    expect(sniffImageType(randomBytes)).toBeNull();
  });

  it("does not crash on truncated buffers", () => {
    expect(sniffImageType(new Uint8Array([0xff]))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("Upload content validation (spoof resistance)", () => {
  it("accepts a JPEG declared as image/jpeg and image/jpg", () => {
    expect(matchesDeclaredType(jpeg, "image/jpeg")).toBe(true);
    expect(matchesDeclaredType(jpeg, "image/jpg")).toBe(true);
  });

  it("rejects a PDF declared as image/png", () => {
    expect(matchesDeclaredType(pdfSpoof, "image/png")).toBe(false);
  });

  it("rejects a script declared as image/jpeg", () => {
    expect(matchesDeclaredType(scriptSpoof, "image/jpeg")).toBe(false);
  });

  it("rejects cross-type mismatches (PNG declared as GIF)", () => {
    expect(matchesDeclaredType(png, "image/gif")).toBe(false);
  });

  it("canonicalises loose MIME spellings", () => {
    expect(canonicalImageType("image/jpg")).toBe("image/jpeg");
    expect(canonicalImageType("image/png")).toBe("image/png");
  });
});
