"use client";

import React, { useActionState, useRef, useState } from "react";
import { createBudgetTransactionAction, type FinanceActionState } from "./actions";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  SUPPORTED_CURRENCIES,
  calculateUahEquivalent,
} from "./schema";

interface Props {
  workOrders: { id: string; number: number; title: string }[];
}

const initialState: FinanceActionState = {};

export function TransactionForm({ workOrders }: Props) {
  const [state, formAction, isPending] = useActionState(createBudgetTransactionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const [currency, setCurrency] = useState("UAH");
  const [amount, setAmount] = useState<string>("");
  const [rate, setRate] = useState<string>("1.0");

  const numAmount = parseFloat(amount) || 0;
  const numRate = parseFloat(rate) || 1.0;
  const uahEquivalent = calculateUahEquivalent(numAmount, numRate);

  return (
    <div className="card stack">
      <h2 className="text-lg font-bold m-0">Додати фінансову витрату / чек</h2>

      {state?.error && <div className="notice notice-error">{state.error}</div>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          if (formRef.current && !state?.error) {
            formRef.current.reset();
            setAmount("");
            setRate("1.0");
            setCurrency("UAH");
          }
        }}
        className="stack"
      >
        <div className="field">
          <label htmlFor="tx-wo">Пов’язана робота / заявка</label>
          <select id="tx-wo" name="work_order_id" defaultValue="">
            <option value="">Загальні витрати території (без прив’язки)</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                #{wo.number} {wo.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="tx-cat">Категорія витрат *</label>
            <select id="tx-cat" name="category" defaultValue="materials">
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="tx-cur">Валюта</label>
            <select
              id="tx-cur"
              name="currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                if (e.target.value === "UAH") {
                  setRate("1.0");
                }
              }}
            >
              {SUPPORTED_CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="tx-amount">Сума в оригінальній валюті *</label>
            <input
              id="tx-amount"
              name="amount"
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="наприклад: 250.00"
            />
            {state?.fieldErrors?.amount && (
              <p className="text-xs text-red-600">{state.fieldErrors.amount[0]}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="tx-rate">Ручний курс до UAH (₴) *</label>
            <input
              id="tx-rate"
              name="exchange_rate_to_uah"
              type="number"
              step="0.0001"
              required
              disabled={currency === "UAH"}
              value={currency === "UAH" ? "1.0" : rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
        </div>

        {currency !== "UAH" && numAmount > 0 && (
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-md text-sm">
            Зафіксований еквівалент:{" "}
            <strong className="text-emerald-800 text-base">{uahEquivalent.toFixed(2)} ₴</strong>
          </div>
        )}

        <div className="field">
          <label htmlFor="tx-desc">Опис операції / номер чеку чи рахунку *</label>
          <textarea
            id="tx-desc"
            name="description"
            required
            rows={2}
            placeholder="Вкажіть призначення платежу, номер чеку, постачальника..."
          />
        </div>

        <div className="button-row">
          <button type="submit" disabled={isPending} className="button">
            {isPending ? "Проведення..." : "Провести операцію"}
          </button>
        </div>
      </form>
    </div>
  );
}
