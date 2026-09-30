import { NextResponse } from "next/server";
import { requireAuth, writeAuditLog, getClientIp } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string; // "inventory", "farm", "batch", "supplier"
    const entityId = formData.get("entityId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 5MB" },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Extension is derived from the validated MIME type — never from the
    // client-supplied filename (which could contain path separators).
    const ext = EXT_BY_TYPE[file.type] || "bin";
    const safeEntity = (entityType || "misc").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    const safeEntityId = (entityId || "general").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    const filename = `${safeEntity}-${safeEntityId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    // Convert file to buffer and write
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const url = `/uploads/${filename}`;

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Upload",
      entityId: filename,
      newValues: { entityType, entityId, originalName: file.name, size: file.size },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      url,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
