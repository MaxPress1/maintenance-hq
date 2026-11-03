"use client";

import React, { useActionState } from "react";
import { saveAnnualBudgetAction, type FinanceActionState } from "./actions";

interface Props {
  currentYear: number;
  currentBudget: { planned_amount: number; reserve_amount: number } | null;
}

const initialState: FinanceActionState = {};

export function AnnualBudgetForm({ currentYear, currentBudget }: Props) {
  const [state, formAction, isPending] = useActionState(saveAnnualBudgetAction, initialState);

  return (
    <div className="card stack">
      <h2 className="text-lg font-bold m-0">Встановити річний бюджет ({currentYear})</h2>

      {state?.error && <div className="notice notice-error">{state.error}</div>}

      <form action={formAction} className="stack">
        <input type="hidden" name="year" value={currentYear} />

        <div className="form-grid">
          <div className="field">
            <label htmlFor="bg-planned">Плановий річний бюджет (₴ UAH) *</label>
            <input
              id="bg-planned"
              name="planned_amount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={currentBudget?.planned_amount ?? 100000}
            />
            {state?.fieldErrors?.planned_amount && (
              <p className="text-xs text-red-600">{state.fieldErrors.planned_amount[0]}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="bg-reserve">Резервний фонд (₴ UAH)</label>
            <input
              id="bg-reserve"
              name="reserve_amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={currentBudget?.reserve_amount ?? 10000}
            />
            {state?.fieldErrors?.reserve_amount && (
              <p className="text-xs text-red-600">{state.fieldErrors.reserve_amount[0]}</p>
            )}
          </div>
        </div>

        <div className="button-row">
          <button type="submit" disabled={isPending} className="button">
            {isPending ? "Збереження..." : "Зберегти бюджет"}
          </button>
        </div>
      </form>
    </div>
  );
}
