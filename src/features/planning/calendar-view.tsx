import React from "react";
import Link from "next/link";
import { type WorkOrder, WORK_ORDER_STATUS_LABELS } from "../work-orders/schema";
import { PriorityBadge, StatusBadge } from "../work-orders/status-badge";
import { formatDate } from "@/lib/dates";

interface Props {
  workOrders: WorkOrder[];
}

export function CalendarView({ workOrders }: Props) {
  // Group work orders by year-month or quarter
  const scheduledOrders = workOrders
    .filter((wo) => wo.planned_start_date || wo.planned_end_date)
    .sort((a, b) => {
      const dateA = a.planned_start_date || a.planned_end_date || "";
      const dateB = b.planned_start_date || b.planned_end_date || "";
      return dateA.localeCompare(dateB);
    });

  const unscheduledOrders = workOrders.filter(
    (wo) => !wo.planned_start_date && !wo.planned_end_date
  );

  return (
    <div className="stack gap-6">
      <div className="card">
        <h2 className="text-lg font-bold mb-4">Графік запланованих робіт</h2>

        {scheduledOrders.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-4">
            Немає робіт із встановленими плановими датами.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Планові дати</th>
                  <th>Робота</th>
                  <th>Об’єкт</th>
                  <th>Пріоритет</th>
                  <th>Статус</th>
                  <th>Відповідальний</th>
                  <th>Планова вартість</th>
                </tr>
              </thead>
              <tbody>
                {scheduledOrders.map((wo) => (
                  <tr key={wo.id}>
                    <td className="font-semibold text-xs whitespace-nowrap text-slate-800">
                      {wo.planned_start_date ? formatDate(wo.planned_start_date) : "—"}
                      {" → "}
                      {wo.planned_end_date ? formatDate(wo.planned_end_date) : "—"}
                    </td>
                    <td>
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="font-semibold text-emerald-800 hover:underline"
                      >
                        #{wo.number} {wo.title}
                      </Link>
                    </td>
                    <td className="text-xs text-gray-600">{wo.asset?.name}</td>
                    <td>
                      <PriorityBadge priority={wo.priority} />
                    </td>
                    <td>
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="text-xs">
                      {wo.responsible?.display_name || (
                        <span className="text-amber-700 italic">Не призначено</span>
                      )}
                    </td>
                    <td className="text-xs font-medium">{wo.planned_cost.toFixed(2)} ₴</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {unscheduledOrders.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold mb-2 text-slate-700">
            Нерозподілені роботи (без планових дат): {unscheduledOrders.length}
          </h3>
          <ul className="record-list">
            {unscheduledOrders.map((wo) => (
              <li key={wo.id} className="flex justify-between items-center text-sm">
                <div>
                  <Link
                    href={`/work-orders/${wo.id}`}
                    className="font-medium text-emerald-800 hover:underline"
                  >
                    #{wo.number} {wo.title}
                  </Link>
                  <span className="text-xs text-gray-500 ml-2">({wo.asset?.name})</span>
                </div>
                <div className="flex gap-2 items-center">
                  <StatusBadge status={wo.status} />
                  <span className="text-xs text-slate-500">
                    Статус: {WORK_ORDER_STATUS_LABELS[wo.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
