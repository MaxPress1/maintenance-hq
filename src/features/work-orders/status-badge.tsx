import React from "react";
import {
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "./schema";

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const styles: Record<WorkOrderStatus, string> = {
    new: "bg-blue-100 text-blue-800 border-blue-200",
    estimating: "bg-purple-100 text-purple-800 border-purple-200",
    pending_approval: "bg-amber-100 text-amber-800 border-amber-200",
    scheduled: "bg-sky-100 text-sky-800 border-sky-200",
    in_progress: "bg-indigo-100 text-indigo-800 border-indigo-200",
    waiting_materials: "bg-orange-100 text-orange-800 border-orange-200",
    waiting_contractor: "bg-yellow-100 text-yellow-800 border-yellow-200",
    review: "bg-teal-100 text-teal-800 border-teal-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    canceled: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || "bg-gray-100 text-gray-800"}`}
    >
      {WORK_ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  const styles: Record<WorkOrderPriority, string> = {
    critical: "bg-rose-100 text-rose-800 font-bold border-rose-300",
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[priority] || "bg-gray-100 text-gray-800"}`}
    >
      {WORK_ORDER_PRIORITY_LABELS[priority] || priority}
    </span>
  );
}
