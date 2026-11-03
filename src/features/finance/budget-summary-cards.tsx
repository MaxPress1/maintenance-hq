import React from "react";
import { type BudgetSummary } from "./schema";

interface Props {
  summary: BudgetSummary;
  year: number;
}

export function BudgetSummaryCards({ summary, year }: Props) {
  return (
    <div className="stack">
      {summary.hasOverrun && (
        <div className="notice notice-error flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <strong className="block">Попередження: Перевищення погодженого ліміту!</strong>
              <span className="text-xs">
                Фактичні витрати перевищили погоджені асигнування на{" "}
                <strong>{summary.overrunAmount.toFixed(2)} ₴</strong>.
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cards" aria-label="Фінансові показники">
        <div className="card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Річний план ({year})</span>
          <strong className="metric text-slate-800">{summary.plannedAmount.toFixed(2)} ₴</strong>
        </div>

        <div className="card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Погоджено під роботи</span>
          <strong className="metric text-indigo-700">{summary.allocatedAmount.toFixed(2)} ₴</strong>
        </div>

        <div className="card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Фактично витрачено</span>
          <strong className={`metric ${summary.hasOverrun ? "text-rose-700" : "text-emerald-700"}`}>
            {summary.actualSpent.toFixed(2)} ₴
          </strong>
        </div>

        <div className="card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Вільний бюджет року</span>
          <strong className="metric text-emerald-800">{summary.freeBudget.toFixed(2)} ₴</strong>
        </div>

        <div className="card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Нерозподілений резерв</span>
          <strong className="metric text-amber-700">{summary.reserveAmount.toFixed(2)} ₴</strong>
        </div>

        <div className="card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Доступно до розподілу</span>
          <strong className="metric text-teal-700">{summary.availableForAllocation.toFixed(2)} ₴</strong>
        </div>
      </div>
    </div>
  );
}
