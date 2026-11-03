"use client";

import React, { useState, useActionState } from "react";
import { createEmergencyReportAction, type ActionState } from "./actions";
import { REPORTED_URGENCIES, REPORTED_URGENCY_LABELS } from "./schema";

interface Props {
  assets: { id: string; name: string; type: string }[];
}

const initialState: ActionState = {};

export function EmergencyReportModal({ assets }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createEmergencyReportAction, initialState);

  const handleSubmit = async (formData: FormData) => {
    await formAction(formData);
    if (!state?.error) {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="button bg-rose-600 hover:bg-rose-700 text-white font-semibold"
      >
        🚨 Повідомити про аварію
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full stack shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-rose-800 m-0">Термінова аварійна заявка</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600">
              Спрощена форма для екстреного виклику та фіксації пошкоджень або аварій.
            </p>

            {state?.error && <div className="notice notice-error">{state.error}</div>}

            <form action={handleSubmit} className="stack">
              <div className="field">
                <label htmlFor="emergency-asset">Об’єкт території *</label>
                <select id="emergency-asset" name="asset_id" required defaultValue="">
                  <option value="" disabled>
                    Оберіть будівлю / приміщення / обладнання
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

              <div className="field">
                <label htmlFor="emergency-desc">Опис аварії / проблеми *</label>
                <textarea
                  id="emergency-desc"
                  name="description"
                  required
                  rows={3}
                  placeholder="Що сталося? Де саме протікання/замикання/руйнування?"
                />
                {state?.fieldErrors?.description && (
                  <p className="text-xs text-red-600">{state.fieldErrors.description[0]}</p>
                )}
              </div>

              <div className="field">
                <label htmlFor="emergency-urgency">Терміновість</label>
                <select id="emergency-urgency" name="reported_urgency" defaultValue="critical">
                  {REPORTED_URGENCIES.filter((u) => u !== "unknown").map((urgency) => (
                    <option key={urgency} value={urgency}>
                      {REPORTED_URGENCY_LABELS[urgency]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="emergency-contact">Контакт заявника (телефон / кабінет)</label>
                <input
                  id="emergency-contact"
                  name="contact"
                  type="text"
                  placeholder="наприклад: +380..., каб. 204"
                />
              </div>

              <div className="button-row justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="button button-secondary"
                  disabled={isPending}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="button bg-rose-600 hover:bg-rose-700"
                >
                  {isPending ? "Реєстрація..." : "Зареєструвати аварію"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
