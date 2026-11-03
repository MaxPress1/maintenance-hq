"use client";

import React, { useState } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORY_LABELS, type BudgetTransaction } from "./schema";
import { stornoTransactionAction } from "./actions";
import { formatDate } from "@/lib/dates";

interface Props {
  transactions: BudgetTransaction[];
  canManage: boolean;
}

export function TransactionsList({ transactions, canManage }: Props) {
  const [selectedForStorno, setSelectedForStorno] = useState<BudgetTransaction | null>(null);
  const [stornoReason, setStornoReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStornoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForStorno) return;
    if (!stornoReason.trim()) {
      setError("Вкажіть причину сторнування");
      return;
    }

    setIsPending(true);
    setError(null);

    const res = await stornoTransactionAction(selectedForStorno.id, stornoReason);
    setIsPending(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSelectedForStorno(null);
      setStornoReason("");
    }
  };

  return (
    <div className="card stack">
      <h2 className="text-lg font-bold m-0">Журнал фінансових операцій</h2>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Робота / Призначення</th>
              <th>Категорія</th>
              <th>Сума (оригінал)</th>
              <th>Курс UAH</th>
              <th>Сума в UAH (₴)</th>
              <th>Опис / Документ</th>
              <th>Автор</th>
              {canManage && <th>Дія</th>}
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="text-center py-6 text-gray-500 italic">
                  Фінансових операцій ще не зареєстровано.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isStorno = tx.is_storno || tx.amount_uah < 0;
                return (
                  <tr key={tx.id} className={isStorno ? "bg-rose-50/50 text-rose-900" : ""}>
                    <td className="text-xs whitespace-nowrap text-slate-600">
                      {formatDate(tx.created_at)}
                    </td>
                    <td>
                      {tx.work_order ? (
                        <Link
                          href={`/work-orders/${tx.work_order.id}`}
                          className="font-medium text-emerald-800 hover:underline text-sm"
                        >
                          #{tx.work_order.number} {tx.work_order.title}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">Загальні витрати</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-700">
                      {EXPENSE_CATEGORY_LABELS[tx.category] || tx.category}
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {tx.amount.toFixed(2)} {tx.currency}
                    </td>
                    <td className="text-xs text-slate-500">
                      {tx.currency === "UAH" ? "—" : tx.exchange_rate_to_uah.toFixed(4)}
                    </td>
                    <td className="font-bold text-sm whitespace-nowrap">
                      {tx.amount_uah.toFixed(2)} ₴
                    </td>
                    <td className="text-xs max-w-xs truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="text-xs text-slate-600">{tx.creator?.display_name || "—"}</td>
                    {canManage && (
                      <td>
                        {!isStorno && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedForStorno(tx);
                              setStornoReason("");
                              setError(null);
                            }}
                            className="button button-danger text-xs py-1 px-2.5 min-h-0"
                          >
                            Сторно
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedForStorno && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full stack shadow-xl">
            <h3 className="text-lg font-bold text-rose-800 m-0">Сторнування фінансової операції</h3>
            <p className="text-sm text-slate-600">
              Ви збираєтесь відсторнувати запис на суму{" "}
              <strong>{selectedForStorno.amount_uah.toFixed(2)} ₴</strong> ({selectedForStorno.description}).
            </p>
            <p className="text-xs text-slate-500 italic">
              Буде створено коригувальний запис зі зворотним знаком для збереження аудиту.
            </p>

            {error && <div className="notice notice-error">{error}</div>}

            <form onSubmit={handleStornoSubmit} className="stack">
              <div className="field">
                <label htmlFor="storno-reason">Обов’язкова причина сторно *</label>
                <textarea
                  id="storno-reason"
                  required
                  rows={3}
                  value={stornoReason}
                  onChange={(e) => setStornoReason(e.target.value)}
                  placeholder="Вкажіть помилку введення, повернення коштів, зміну чеку..."
                />
              </div>

              <div className="button-row justify-end">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setSelectedForStorno(null)}
                  disabled={isPending}
                >
                  Скасувати
                </button>
                <button type="submit" className="button button-danger" disabled={isPending}>
                  {isPending ? "Сторнування..." : "Підтвердити сторно"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
