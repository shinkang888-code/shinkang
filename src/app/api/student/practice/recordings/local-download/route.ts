/**
 * GET /api/student/practice/recordings/local-download?key=...
 * Development-only local file storage proxy.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { localFilePath } from "@/lib/storage";

export async function GET(req: NextRequest) {
  if (process.env.STORAGE_LOCAL_MODE !== "true") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const filePath = localFilePath(key);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/webm",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
