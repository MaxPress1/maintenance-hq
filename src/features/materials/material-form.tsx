"use client";

import React, { useActionState, useRef } from "react";
import { createMaterialAction, type MaterialActionState } from "./actions";

const initialState: MaterialActionState = {};

export function MaterialForm() {
  const [state, formAction, isPending] = useActionState(createMaterialAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="card stack max-w-2xl">
      <h2 className="text-lg font-bold m-0">Додати новий матеріал</h2>

      {state?.error && <div className="notice notice-error">{state.error}</div>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          if (formRef.current && !state?.error) {
            formRef.current.reset();
          }
        }}
        className="stack"
      >
        <div className="form-grid">
          <div className="field">
            <label htmlFor="mat-name">Назва матеріалу *</label>
            <input
              id="mat-name"
              name="name"
              type="text"
              required
              placeholder="наприклад: Муфта сполучна 1/2"
            />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-red-600">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="mat-cat">Категорія</label>
            <input
              id="mat-cat"
              name="category"
              type="text"
              defaultValue="Сантехніка"
              placeholder="наприклад: Електрика, Сантехніка, Кріплення"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="mat-unit">Одиниця виміру *</label>
            <input id="mat-unit" name="unit" type="text" required defaultValue="шт" />
          </div>

          <div className="field">
            <label htmlFor="mat-price">Орієнтовна ціна за од. (₴ UAH)</label>
            <input
              id="mat-price"
              name="estimated_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
            />
          </div>

          <div className="field">
            <label htmlFor="mat-stock">Початковий залишок</label>
            <input
              id="mat-stock"
              name="stock_quantity"
              type="number"
              step="0.001"
              min="0"
              defaultValue="0"
            />
          </div>

          <div className="field">
            <label htmlFor="mat-min">Мін. залишок (поріг)</label>
            <input
              id="mat-min"
              name="min_stock_level"
              type="number"
              step="0.001"
              min="0"
              defaultValue="5"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="mat-supplier">Постачальник / Контакти</label>
          <input
            id="mat-supplier"
            name="supplier"
            type="text"
            placeholder="наприклад: ТОВ Епіцентр, тел..."
          />
        </div>

        <div className="button-row">
          <button type="submit" disabled={isPending} className="button">
            {isPending ? "Збереження..." : "Додати до довідника"}
          </button>
        </div>
      </form>
    </div>
  );
}
