"use client";

import React from "react";
import Link from "next/link";
import {
  WORK_ORDER_STATUS_LABELS,
  type WorkOrder,
  type WorkOrderStatus,
} from "../work-orders/schema";
import { PriorityBadge } from "../work-orders/status-badge";
import { formatDate } from "@/lib/dates";

interface Props {
  workOrders: WorkOrder[];
}

const COLUMNS: WorkOrderStatus[] = [
  "new",
  "scheduled",
  "in_progress",
  "waiting_materials",
  "review",
  "completed",
];

export function KanbanBoard({ workOrders }: Props) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-[1000px]">
        {COLUMNS.map((status) => {
          const columnOrders = workOrders.filter((wo) => wo.status === status);
          return (
            <div
              key={status}
              className="flex-1 bg-slate-100/70 border border-slate-200 rounded-lg p-3 flex flex-col min-w-[200px]"
            >
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                <span className="font-semibold text-xs uppercase tracking-wide text-slate-700">
                  {WORK_ORDER_STATUS_LABELS[status]}
                </span>
                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-2.5">
                {columnOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Немає робіт</p>
                ) : (
                  columnOrders.map((wo) => (
                    <div
                      key={wo.id}
                      className="bg-white p-3 rounded-md border border-slate-200 shadow-sm hover:shadow transition-shadow stack"
                    >
                      <div className="flex justify-between items-start gap-1">
                        <Link
                          href={`/work-orders/${wo.id}`}
                          className="font-semibold text-sm text-emerald-800 hover:underline leading-snug"
                        >
                          #{wo.number} {wo.title}
                        </Link>
                      </div>

                      <div className="text-xs text-slate-500">
                        {wo.asset?.name || "Об’єкт"}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <PriorityBadge priority={wo.priority} />
                        <span className="text-slate-500">
                          {wo.planned_end_date ? formatDate(wo.planned_end_date) : "—"}
                        </span>
                      </div>

                      {wo.responsible?.display_name && (
                        <div className="text-xs text-slate-600 truncate">
                          👤 {wo.responsible.display_name}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
