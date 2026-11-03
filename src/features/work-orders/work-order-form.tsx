"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import { createWorkOrderAction, type ActionState } from "./actions";
import {
  REPORTED_URGENCIES,
  REPORTED_URGENCY_LABELS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
} from "./schema";

interface Props {
  assets: { id: string; name: string; type: string }[];
  profiles: { id: string; display_name: string }[];
}

const initialState: ActionState = {};

export function WorkOrderForm({ assets, profiles }: Props) {
  const [state, formAction, isPending] = useActionState(createWorkOrderAction, initialState);

  return (
    <form action={formAction} className="card stack max-w-3xl">
      {state?.error && <div className="notice notice-error">{state.error}</div>}

      <div className="field">
        <label htmlFor="wo-title">Назва роботи / заявки *</label>
        <input
          id="wo-title"
          name="title"
          type="text"
          required
          placeholder="наприклад: Заміна радіатора в аудиторії 101"
        />
        {state?.fieldErrors?.title && (
          <p className="text-xs text-red-600">{state.fieldErrors.title[0]}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="wo-asset">Об’єкт території *</label>
        <select id="wo-asset" name="asset_id" required defaultValue="">
          <option value="" disabled>
            Оберіть об’єкт
          </option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name} ({asset.type})
            </option>
          ))}
        </select>
        {state?.fieldErrors?.asset_id && (
          <p className="text-xs text-red-600">{state.fieldErrors.asset_id[0]}</p>
        )}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="wo-type">Тип роботи</label>
          <select id="wo-type" name="work_type" defaultValue="planned">
            {WORK_TYPES.map((type) => (
              <option key={type} value={type}>
                {WORK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="wo-priority">Пріоритет</label>
          <select id="wo-priority" name="priority" defaultValue="medium">
            {WORK_ORDER_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {WORK_ORDER_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="wo-urgency">Терміновість</label>
          <select id="wo-urgency" name="reported_urgency" defaultValue="medium">
            {REPORTED_URGENCIES.filter((u) => u !== "unknown").map((urgency) => (
              <option key={urgency} value={urgency}>
                {REPORTED_URGENCY_LABELS[urgency]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="wo-responsible">Відповідальний</label>
          <select id="wo-responsible" name="responsible_id" defaultValue="">
            <option value="">Не призначено (нова заявка)</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="wo-start">Планова дата початку</label>
          <input id="wo-start" name="planned_start_date" type="date" />
        </div>

        <div className="field">
          <label htmlFor="wo-end">Планова дата завершення</label>
          <input id="wo-end" name="planned_end_date" type="date" />
          {state?.fieldErrors?.planned_end_date && (
            <p className="text-xs text-red-600">{state.fieldErrors.planned_end_date[0]}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="wo-cost">Планова вартість (₴ UAH)</label>
          <input id="wo-cost" name="planned_cost" type="number" step="0.01" min="0" defaultValue="0" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="wo-desc">Детальний опис робіт / проблеми</label>
        <textarea
          id="wo-desc"
          name="description"
          rows={4}
          placeholder="Опишіть завдання, необхідні заходи, дефекти чи особливості..."
        />
      </div>

      <div className="button-row">
        <button type="submit" disabled={isPending} className="button">
          {isPending ? "Збереження..." : "Створити роботу"}
        </button>
        <Link href="/work-orders" className="button button-secondary">
          Скасувати
        </Link>
      </div>
    </form>
  );
}
