"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StatusBadge, PriorityBadge } from "./status-badge";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
  type WorkOrder,
} from "./schema";
import { formatDate } from "@/lib/dates";

interface Props {
  workOrders: WorkOrder[];
}

export function WorkOrderList({ workOrders }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredOrders = workOrders.filter((wo) => {
    if (statusFilter && wo.status !== statusFilter) return false;
    if (priorityFilter && wo.priority !== priorityFilter) return false;
    if (typeFilter && wo.work_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = wo.title.toLowerCase().includes(q);
      const matchDesc = wo.description?.toLowerCase().includes(q);
      const matchAsset = wo.asset?.name?.toLowerCase().includes(q);
      const matchNum = String(wo.number).includes(q);
      if (!matchTitle && !matchDesc && !matchAsset && !matchNum) return false;
    }
    return true;
  });

  return (
    <div className="stack">
      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="search-wo">Пошук</label>
            <input
              id="search-wo"
              type="search"
              placeholder="Пошук за назвою, номером, об'єктом..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="filter-status">Статус</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Всі статуси</option>
              {WORK_ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {WORK_ORDER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-priority">Пріоритет</label>
            <select
              id="filter-priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">Всі пріоритети</option>
              {WORK_ORDER_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {WORK_ORDER_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-type">Тип робіт</label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Всі типи</option>
              {WORK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WORK_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>№ / Назва</th>
                <th>Об’єкт</th>
                <th>Тип</th>
                <th>Пріоритет</th>
                <th>Статус</th>
                <th>Відповідальний</th>
                <th>Дедлайн</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500 italic">
                    Заявок або робіт не знайдено.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((wo) => {
                  const isCritical = wo.priority === "critical" || wo.work_type === "emergency";
                  return (
                    <tr
                      key={wo.id}
                      className={isCritical ? "bg-rose-50/50 hover:bg-rose-100/50" : "hover:bg-gray-50"}
                    >
                      <td>
                        <Link
                          href={`/work-orders/${wo.id}`}
                          className="font-semibold text-emerald-800 hover:underline block"
                        >
                          #{wo.number} {wo.title}
                        </Link>
                        {wo.source === "public" && (
                          <span className="pill text-xs bg-amber-100 text-amber-800">
                            Публічна форма
                          </span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/assets/${wo.asset_id}`}
                          className="text-gray-700 hover:text-emerald-700 hover:underline text-sm"
                        >
                          {wo.asset?.name || "Об’єкт"}
                        </Link>
                      </td>
                      <td className="text-xs text-gray-600">
                        {WORK_TYPE_LABELS[wo.work_type]}
                      </td>
                      <td>
                        <PriorityBadge priority={wo.priority} />
                      </td>
                      <td>
                        <StatusBadge status={wo.status} />
                      </td>
                      <td className="text-sm">
                        {wo.responsible?.display_name ? (
                          <span>{wo.responsible.display_name}</span>
                        ) : (
                          <span className="text-amber-700 italic text-xs">Не призначено</span>
                        )}
                      </td>
                      <td className="text-xs text-gray-600">
                        {wo.planned_end_date ? formatDate(wo.planned_end_date) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
