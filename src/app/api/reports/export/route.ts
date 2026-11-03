import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { generateReportData } from "@/features/reports/queries";
import { generateCsv } from "@/lib/export/csv";
import { type ReportType } from "@/features/reports/schema";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("reports.read");
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const reportType = (searchParams.get("type") || "completed_period") as ReportType;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const assetId = searchParams.get("assetId") || undefined;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;

  const data = await generateReportData({
    reportType,
    startDate,
    endDate,
    assetId,
    year,
  });

  const csv = generateCsv(data.headers, data.rows);

  const filename = `report_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
