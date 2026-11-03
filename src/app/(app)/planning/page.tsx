import React from "react";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getWorkOrders } from "@/features/work-orders/queries";
import { KanbanBoard } from "@/features/planning/kanban-board";
import { CalendarView } from "@/features/planning/calendar-view";
import { WorkOrderList } from "@/features/work-orders/work-order-list";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ view?: string }>;
}

export default async function PlanningPage({ searchParams }: Props) {
  await requirePagePermission("planning.read");
  const { view = "kanban" } = await searchParams;
  const workOrders = await getWorkOrders();

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <span className="eyebrow">Планування та графік</span>
          <h1 className="page-heading">Річний план і календар робіт</h1>
        </div>
        <div className="button-row">
          <Link href="/work-orders/new" className="button">
            + Запланувати роботу
          </Link>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <Link
          href="/planning?view=kanban"
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            view === "kanban"
              ? "bg-emerald-700 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          📋 Канбан-дошка
        </Link>
        <Link
          href="/planning?view=calendar"
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            view === "calendar"
              ? "bg-emerald-700 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          📅 Календар і графік
        </Link>
        <Link
          href="/planning?view=table"
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            view === "table"
              ? "bg-emerald-700 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          📑 Табличний реєстр
        </Link>
      </div>

      {view === "kanban" && <KanbanBoard workOrders={workOrders} />}
      {view === "calendar" && <CalendarView workOrders={workOrders} />}
      {view === "table" && <WorkOrderList workOrders={workOrders} />}
    </div>
  );
}
