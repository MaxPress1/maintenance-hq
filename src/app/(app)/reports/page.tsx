import React from "react";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getAssets } from "@/features/assets/queries";
import { generateReportData } from "@/features/reports/queries";
import {
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  type ReportType,
} from "@/features/reports/schema";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    type?: string;
    startDate?: string;
    endDate?: string;
    assetId?: string;
    year?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  await requirePagePermission("reports.read");

  const params = await searchParams;
  const currentType = (params.type || "completed_period") as ReportType;
  const startDate = params.startDate || "";
  const endDate = params.endDate || "";
  const assetId = params.assetId || "";
  const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear();

  const [assets, report] = await Promise.all([
    getAssets(),
    generateReportData({
      reportType: currentType,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      assetId: assetId || undefined,
      year,
    }),
  ]);

  const exportUrl = `/api/reports/export?type=${currentType}&startDate=${startDate}&endDate=${endDate}&assetId=${assetId}&year=${year}`;

  return (
    <div className="stack gap-6">
      <div className="page-title">
        <div>
          <span className="eyebrow">Аналітика та експорт</span>
          <h1 className="page-heading">Звіти діяльності та витрат</h1>
        </div>
        <div className="button-row">
          <a
            href={exportUrl}
            download
            className="button bg-emerald-800 hover:bg-emerald-900 text-white font-semibold"
          >
            📥 Експортувати в CSV
          </a>
        </div>
      </div>

      <div className="card">
        <form method="get" className="form-grid">
          <div className="field">
            <label htmlFor="rep-type">Тип звіту</label>
            <select id="rep-type" name="type" defaultValue={currentType}>
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rep-asset">Фільтр за об’єктом</label>
            <select id="rep-asset" name="assetId" defaultValue={assetId}>
              <option value="">Всі об’єкти</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rep-start">Початкова дата</label>
            <input id="rep-start" name="startDate" type="date" defaultValue={startDate} />
          </div>

          <div className="field">
            <label htmlFor="rep-end">Кінцева дата</label>
            <input id="rep-end" name="endDate" type="date" defaultValue={endDate} />
          </div>

          <div className="field self-end">
            <button type="submit" className="button w-full">
              Сформувати звіт
            </button>
          </div>
        </form>
      </div>

      <div className="card stack">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-lg font-bold m-0">{report.title}</h2>
          <span className="text-xs text-slate-500 font-medium">
            Знайдено рядків: {report.rows.length}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {report.headers.map((header, idx) => (
                  <th key={idx}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={report.headers.length} className="text-center py-6 text-gray-500 italic">
                    За обраними критеріями записів не знайдено.
                  </td>
                </tr>
              ) : (
                report.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="text-sm">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
