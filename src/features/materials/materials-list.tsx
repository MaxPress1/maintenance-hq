"use client";

import React, { useState } from "react";
import { type Material } from "./schema";
import { adjustMaterialStockAction } from "./actions";

interface Props {
  materials: Material[];
  canManage: boolean;
}

export function MaterialsList({ materials, canManage }: Props) {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [delta, setDelta] = useState<string>("0");
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    const numDelta = parseFloat(delta);
    if (isNaN(numDelta) || numDelta === 0) {
      setError("Вкажіть ненульове число коригування (+ або -)");
      return;
    }
    if (!reason.trim()) {
      setError("Вкажіть причину зміни залишку");
      return;
    }

    setIsPending(true);
    setError(null);

    const formData = new FormData();
    formData.append("material_id", selectedMaterial.id);
    formData.append("delta", delta);
    formData.append("reason", reason);

    const res = await adjustMaterialStockAction({}, formData);
    setIsPending(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSelectedMaterial(null);
      setDelta("0");
      setReason("");
    }
  };

  return (
    <div className="card stack">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Назва матеріалу</th>
              <th>Категорія</th>
              <th>Од. виміру</th>
              <th>Орієнтовна ціна</th>
              <th>Залишок</th>
              <th>Мін. ліміт</th>
              <th>Постачальник</th>
              {canManage && <th>Дії</th>}
            </tr>
          </thead>
          <tbody>
            {materials.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-6 text-gray-500 italic">
                  Матеріалів у довіднику ще немає.
                </td>
              </tr>
            ) : (
              materials.map((mat) => {
                const isLow = mat.stock_quantity <= mat.min_stock_level && mat.min_stock_level > 0;
                return (
                  <tr key={mat.id} className={isLow ? "bg-amber-50" : ""}>
                    <td className="font-semibold text-slate-800">{mat.name}</td>
                    <td className="text-xs text-slate-600">{mat.category}</td>
                    <td className="text-xs text-slate-600">{mat.unit}</td>
                    <td className="text-sm font-medium">{mat.estimated_price.toFixed(2)} ₴</td>
                    <td>
                      <span className={`font-bold ${isLow ? "text-amber-700" : "text-emerald-800"}`}>
                        {mat.stock_quantity} {mat.unit}
                      </span>
                      {isLow && (
                        <span className="pill text-[10px] bg-amber-200 text-amber-900 ml-2">
                          Низький запас!
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">{mat.min_stock_level} {mat.unit}</td>
                    <td className="text-xs text-slate-600">{mat.supplier || "—"}</td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMaterial(mat);
                            setDelta("0");
                            setReason("");
                            setError(null);
                          }}
                          className="button button-secondary text-xs py-1 px-2.5 min-h-0"
                        >
                          ± Коригувати
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedMaterial && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full stack shadow-xl">
            <h3 className="text-lg font-bold m-0">Коригування залишку</h3>
            <p className="text-sm text-slate-600">
              Матеріал: <span className="font-semibold text-slate-800">{selectedMaterial.name}</span>{" "}
              (поточний залишок: {selectedMaterial.stock_quantity} {selectedMaterial.unit})
            </p>

            {error && <div className="notice notice-error">{error}</div>}

            <form onSubmit={handleAdjustSubmit} className="stack">
              <div className="field">
                <label htmlFor="adj-delta">Зміна кількості (+ додавання, - списання) *</label>
                <input
                  id="adj-delta"
                  type="number"
                  step="0.001"
                  required
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="наприклад: +10 або -2"
                />
              </div>

              <div className="field">
                <label htmlFor="adj-reason">Причина коригування *</label>
                <textarea
                  id="adj-reason"
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="наприклад: Поставка зі складу, інвентаризація, псування тощо..."
                />
              </div>

              <div className="button-row justify-end">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setSelectedMaterial(null)}
                  disabled={isPending}
                >
                  Скасувати
                </button>
                <button type="submit" className="button" disabled={isPending}>
                  {isPending ? "Збереження..." : "Зафіксувати залишок"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
