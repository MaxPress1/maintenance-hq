"use client";

import React, { useState, useTransition } from "react";
import { transitionWorkOrderStatusAction } from "./actions";
import {
  ALLOWED_TRANSITIONS,
  WORK_ORDER_STATUS_LABELS,
  canTransitionWorkOrder,
  type WorkOrderStatus,
} from "./schema";

interface Props {
  workOrderId: string;
  currentStatus: WorkOrderStatus;
  userRoles: string[];
  isAssigned: boolean;
  hasResponsible: boolean;
}

export function StatusTransitionButtons({
  workOrderId,
  currentStatus,
  userRoles,
  isAssigned,
  hasResponsible,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionResult, setCompletionResult] = useState("");

  const possibleTransitions = ALLOWED_TRANSITIONS[currentStatus] || [];
  const isCoordinator = userRoles.includes("administrator") || userRoles.includes("coordinator");
  const isWorker = userRoles.includes("worker");

  if (!isCoordinator && !isWorker) {
    return null;
  }

  const handleTransition = (targetStatus: WorkOrderStatus) => {
    if (targetStatus === "completed") {
      setShowCompleteModal(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await transitionWorkOrderStatusAction(workOrderId, targetStatus);
      if (res.error) {
        setError(res.error);
      }
    });
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionResult.trim()) {
      setError("Вкажіть результат виконання робіт");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await transitionWorkOrderStatusAction(
        workOrderId,
        "completed",
        completionResult.trim()
      );
      if (res.error) {
        setError(res.error);
      } else {
        setShowCompleteModal(false);
      }
    });
  };

  return (
    <div className="card stack">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base m-0">Зміна статусу</h3>
        <span className="text-xs text-gray-500">
          Поточний: {WORK_ORDER_STATUS_LABELS[currentStatus]}
        </span>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="button-row">
        {possibleTransitions.map((target) => {
          const check = canTransitionWorkOrder(
            currentStatus,
            target,
            userRoles,
            isAssigned,
            hasResponsible
          );

          if (!check.allowed && !isCoordinator) {
            return null;
          }

          const isDestructive = target === "canceled";
          const isSuccess = target === "completed";

          return (
            <button
              key={target}
              type="button"
              disabled={isPending || !check.allowed}
              onClick={() => handleTransition(target)}
              className={`button ${isDestructive ? "button-danger" : isSuccess ? "bg-emerald-600 hover:bg-emerald-700" : "button-secondary"}`}
            >
              {target === "in_progress"
                ? "▶ Розпочати роботу"
                : target === "review"
                ? "✓ Передати на перевірку"
                : target === "completed"
                ? "★ Завершити та закрити"
                : target === "canceled"
                ? "✕ Скасувати"
                : `→ ${WORK_ORDER_STATUS_LABELS[target]}`}
            </button>
          );
        })}
      </div>

      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full stack shadow-xl">
            <h3 className="text-lg font-bold m-0">Підтвердження завершення робіт</h3>
            <p className="text-sm text-gray-600">
              Для закриття заявки опишіть виконані роботи, використані матеріали та кінцевий результат.
            </p>
            <form onSubmit={handleCompleteSubmit} className="stack">
              <div className="field">
                <label htmlFor="completion-result">Звіт про результат *</label>
                <textarea
                  id="completion-result"
                  required
                  rows={4}
                  value={completionResult}
                  onChange={(e) => setCompletionResult(e.target.value)}
                  placeholder="Опишіть, що саме було відремонтовано/зроблено..."
                />
              </div>

              <div className="button-row justify-end">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowCompleteModal(false)}
                  disabled={isPending}
                >
                  Скасувати
                </button>
                <button type="submit" className="button bg-emerald-600" disabled={isPending}>
                  {isPending ? "Збереження..." : "Підтвердити завершення"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
