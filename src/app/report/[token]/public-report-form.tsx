"use client";

import React, { useActionState } from "react";
import { submitPublicReportAction, type ActionState } from "@/features/work-orders/actions";
import { REPORTED_URGENCIES, REPORTED_URGENCY_LABELS } from "@/features/work-orders/schema";

interface Props {
  token: string;
}

const initialState: ActionState = {};

export function PublicReportForm({ token }: Props) {
  const [state, formAction, isPending] = useActionState(submitPublicReportAction, initialState);

  if (state?.success) {
    return (
      <div className="text-center py-6 stack">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ✓
        </div>
        <h2 className="text-xl font-bold text-slate-800 m-0">Заявку прийнято!</h2>
        <p className="text-sm text-slate-600">
          Вашій заявці присвоєно номер <span className="font-bold text-emerald-700">#{state.id}</span>.
        </p>
        <p className="text-xs text-slate-500">
          Координатор технічної служби перевірить повідомлення та призначить відповідального майстра.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="token" value={token} />

      {state?.error && <div className="notice notice-error">{state.error}</div>}

      <div className="field">
        <label htmlFor="pub-desc" className="text-sm font-semibold text-slate-700">
          Опис несправності *
        </label>
        <textarea
          id="pub-desc"
          name="description"
          required
          rows={4}
          placeholder="Детально опишіть проблему (наприклад: поламаний замок, протікає кран, відсутнє освітлення...)"
          className="border border-slate-300 rounded-lg p-2.5 text-sm"
        />
        {state?.fieldErrors?.description && (
          <p className="text-xs text-rose-600">{state.fieldErrors.description[0]}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="pub-urgency" className="text-sm font-semibold text-slate-700">
          Терміновість
        </label>
        <select
          id="pub-urgency"
          name="reported_urgency"
          defaultValue="high"
          className="border border-slate-300 rounded-lg p-2.5 text-sm"
        >
          {REPORTED_URGENCIES.filter((u) => u !== "unknown").map((u) => (
            <option key={u} value={u}>
              {REPORTED_URGENCY_LABELS[u]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="pub-contact" className="text-sm font-semibold text-slate-700">
          Ваш контактний телефон / ім’я (необов’язково)
        </label>
        <input
          id="pub-contact"
          name="contact_info"
          type="text"
          placeholder="Щоб майстер міг уточнити деталі..."
          className="border border-slate-300 rounded-lg p-2.5 text-sm"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="button w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-lg shadow-sm"
        >
          {isPending ? "Відправка..." : "Надіслати заявку"}
        </button>
      </div>
    </form>
  );
}
