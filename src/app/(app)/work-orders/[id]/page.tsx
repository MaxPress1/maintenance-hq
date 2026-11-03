import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/permissions";
import { getWorkOrderById, getWorkOrderComments, getAttachments } from "@/features/work-orders/queries";
import {
  WORK_TYPE_LABELS,
  REPORTED_URGENCY_LABELS,
} from "@/features/work-orders/schema";
import { StatusBadge, PriorityBadge } from "@/features/work-orders/status-badge";
import { StatusTransitionButtons } from "@/features/work-orders/status-transition-buttons";
import { CommentsSection } from "@/features/work-orders/comments-section";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const context = await requirePageSession();
  const [workOrder, comments, attachments] = await Promise.all([
    getWorkOrderById(id),
    getWorkOrderComments(id),
    getAttachments("work_order", id),
  ]);

  if (!workOrder) {
    notFound();
  }

  const isAssigned =
    workOrder.responsible_id === context.user.id ||
    workOrder.assignments?.some((a) => a.user_id === context.user.id);

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">Заявка #{workOrder.number}</span>
            <PriorityBadge priority={workOrder.priority} />
            <StatusBadge status={workOrder.status} />
          </div>
          <h1 className="page-heading mb-0">{workOrder.title}</h1>
        </div>
        <div className="button-row">
          <Link href="/work-orders" className="button button-secondary">
            ← До списку робіт
          </Link>
        </div>
      </div>

      <div className="grid two-columns gap-6">
        <div className="stack">
          {/* Card with details */}
          <div className="card stack">
            <h2 className="text-lg font-bold m-0 border-b pb-2">Деталі завдання</h2>

            <dl className="details-grid">
              <div>
                <dt>Об’єкт</dt>
                <dd>
                  <Link
                    href={`/assets/${workOrder.asset_id}`}
                    className="font-semibold text-emerald-800 hover:underline"
                  >
                    {workOrder.asset?.name || "Об’єкт"}
                  </Link>
                  {workOrder.asset?.site?.name && (
                    <span className="text-xs text-gray-500 block">
                      {workOrder.asset.site.name}
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt>Тип роботи</dt>
                <dd>{WORK_TYPE_LABELS[workOrder.work_type] || workOrder.work_type}</dd>
              </div>

              <div>
                <dt>Заявлена терміновість</dt>
                <dd>{REPORTED_URGENCY_LABELS[workOrder.reported_urgency] || "—"}</dd>
              </div>

              <div>
                <dt>Джерело</dt>
                <dd>
                  {workOrder.source === "public" ? "Публічна форма (QR/Токен)" : "Внутрішня система"}
                </dd>
              </div>

              <div>
                <dt>Відповідальний</dt>
                <dd className="font-medium text-gray-900">
                  {workOrder.responsible?.display_name || (
                    <span className="text-amber-700 italic">Не призначено</span>
                  )}
                </dd>
              </div>

              <div>
                <dt>Автор заявки</dt>
                <dd>{workOrder.author?.display_name || "Невідомо"}</dd>
              </div>

              <div>
                <dt>Планові дати</dt>
                <dd>
                  {workOrder.planned_start_date ? formatDate(workOrder.planned_start_date) : "—"}
                  {" — "}
                  {workOrder.planned_end_date ? formatDate(workOrder.planned_end_date) : "—"}
                </dd>
              </div>

              <div>
                <dt>Планова вартість</dt>
                <dd className="font-semibold">{workOrder.planned_cost.toFixed(2)} ₴</dd>
              </div>

              <div>
                <dt>Фактичні витрати</dt>
                <dd className="font-semibold text-emerald-700">{workOrder.actual_cost.toFixed(2)} ₴</dd>
              </div>
            </dl>

            {workOrder.description && (
              <div className="mt-2 pt-3 border-t">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Опис / Зауваження:</h3>
                <p className="text-sm pre-wrap text-gray-800 m-0">{workOrder.description}</p>
              </div>
            )}

            {workOrder.status === "completed" && (
              <div className="mt-2 pt-3 border-t bg-emerald-50 p-3 rounded-md">
                <h3 className="text-sm font-bold text-emerald-900 mb-1">✓ Результат виконання робіт</h3>
                <p className="text-sm pre-wrap text-emerald-800 m-0">{workOrder.completion_result}</p>
                <div className="text-xs text-emerald-700 mt-2">
                  Закрив: {workOrder.completed_by_profile?.display_name || "Користувач"} (
                  {workOrder.completed_at ? formatDate(workOrder.completed_at) : "—"})
                </div>
              </div>
            )}
          </div>

          <CommentsSection workOrderId={workOrder.id} comments={comments} />
        </div>

        <div className="stack">
          {/* Status Transitions */}
          <StatusTransitionButtons
            workOrderId={workOrder.id}
            currentStatus={workOrder.status}
            userRoles={context.roles}
            isAssigned={Boolean(isAssigned)}
            hasResponsible={Boolean(workOrder.responsible_id)}
          />

          {/* Attachments / Photos */}
          <div className="card stack">
            <h3 className="font-semibold text-lg m-0">Фото та документи ({attachments.length})</h3>
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Вкладень поки немає.</p>
            ) : (
              <ul className="record-list">
                {attachments.map((att) => (
                  <li key={att.id} className="flex justify-between items-center text-sm py-2">
                    <div>
                      <span className="font-medium block">{att.file_name}</span>
                      <span className="text-xs text-gray-500">
                        {att.phase} · {(att.file_size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
