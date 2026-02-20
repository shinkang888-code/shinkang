/**
 * PUT /api/student/practice/recordings/local-upload?key=...
 * Development-only local file storage proxy.
 * In production, upload goes directly to S3 via presigned URL.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { ensureLocalDir, localFilePath } from "@/lib/storage";

export async function PUT(req: NextRequest) {
  if (process.env.STORAGE_LOCAL_MODE !== "true") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  ensureLocalDir();
  const filePath = localFilePath(key);

  const arrayBuffer = await req.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  return NextResponse.json({ ok: true, key }, { status: 200 });
}
