/**
 * GET /api/academy/classes/[id]/attendance/export?month=YYYY-MM
 * Download a CSV of attendance for a specific class + month.
 *
 * CSV columns:
 *   Date, Session Status, Student Name, Student Email, Attendance Status, Memo, Marked By, Marked At
 *
 * Allowed: ADMIN, SUPER_ADMIN, TEACHER (own classes)
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";

interface Params { params: Promise<{ id: string }> }

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id: classId } = await params;
  const academyId = ctx.academyId!;
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return err("month query param is required (YYYY-MM)", 400);
  }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId },
    select: { id: true, name: true, teacherUserId: true },
  });
  if (!cls) return err("Class not found", 404);

  if (ctx.user.role === "TEACHER" && cls.teacherUserId !== ctx.user.sub) {
    return err("Forbidden", 403);
  }

  const records = await prisma.attendance.findMany({
    where: {
      academyId,
      classId,
      session: {
        localDate: { gte: `${month}-01`, lte: `${month}-31` },
      },
    },
    include: {
      student:  { select: { name: true, email: true } },
      session:  { select: { localDate: true, status: true } },
      markedBy: { select: { name: true } },
    },
    orderBy: [
      { session: { localDate: "asc" } },
      { student: { name:      "asc" } },
    ],
  });

  // Build CSV
  const header = ["Date", "Session Status", "Student Name", "Student Email", "Attendance Status", "Memo", "Marked By", "Marked At"];
  const rows = records.map((r) => [
    r.session.localDate,
    r.session.status,
    r.student.name,
    r.student.email,
    r.status,
    r.memo ?? "",
    r.markedBy?.name ?? "",
    r.markedAt ? r.markedAt.toISOString() : "",
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n");

  const filename = `attendance_${cls.name.replace(/\s+/g, "_")}_${month}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
