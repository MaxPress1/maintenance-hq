import React from "react";
import { notFound } from "next/navigation";
import { getPublicReportToken } from "@/features/work-orders/queries";
import { PublicReportForm } from "./public-report-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicReportPage({ params }: Props) {
  const { token } = await params;
  const tokenData = await getPublicReportToken(token);

  if (!tokenData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6 stack border border-slate-200">
        <div className="text-center pb-2 border-b">
          <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold block mb-1">
            Maintenance HQ · Публічна форма
          </span>
          <h1 className="text-xl font-bold text-slate-800 m-0">Повідомити про несправність</h1>
          <p className="text-xs text-slate-500 mt-1">
            Об’єкт: <span className="font-semibold text-slate-700">{tokenData.asset?.name}</span>
            {tokenData.asset?.site?.name ? ` (${tokenData.asset.site.name})` : ""}
          </p>
        </div>

        <PublicReportForm token={token} />
      </div>
    </div>
  );
}
