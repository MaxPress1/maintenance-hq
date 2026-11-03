"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError, z } from "zod";
import { AccessDeniedError, requirePermission } from "@/lib/auth/permissions";
import { formString, uuidSchema } from "@/lib/validation";
import { endOfKyivDay } from "@/lib/dates";
import type { ActionState } from "@/components/ui/action-form";
import { assetSchema, inspectionSchema, siteSchema } from "./schema";

function failure(error: unknown): ActionState {
  if (error instanceof ZodError) return { error: "Перевірте поля: назву, тип, дати та вибрані об’єкти." };
  if (error instanceof AccessDeniedError) return { error: error.status === 401 ? "Сесія завершилась. Увійдіть повторно." : "Недостатньо прав для цієї операції." };
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "23514") return { error: "Зміна порушує правила обліку. Перевірте ієрархію, активність відповідального, архівні об’єкти та дати оглядів." };
  if (code === "22023") return { error: "Цю форму вже збережено з іншими даними. Оновіть сторінку перед новою операцією." };
  if (code === "PGRST116") return { error: "Запис уже змінено або недоступний. Оновіть сторінку й повторіть зміни." };
  return { error: "Не вдалося зберегти дані. Перевірте з’єднання та повторіть спробу. Введені дані залишаються у формі." };
}

function refreshAssets() {
  revalidatePath("/assets", "layout");
  revalidatePath("/sites");
  revalidatePath("/");
  revalidatePath("/audit");
}

export async function saveAsset(_state: ActionState, form: FormData): Promise<ActionState> {
  let savedId: string;
  try {
    const { supabase } = await requirePermission("assets.manage");
    const parsed = assetSchema.parse(Object.fromEntries(form));
    const { next_inspection_date, ...fields } = parsed;
    const payload = { ...fields, next_inspection_at: endOfKyivDay(next_inspection_date) };
    const id = formString(form, "id");
    if (id) {
      uuidSchema.parse(id);
      const version = z.iso.datetime({ offset: true }).parse(formString(form, "updated_at"));
      const { error } = await supabase.from("assets").update(payload).eq("id", id).eq("updated_at", version).select("id").single();
      if (error) throw error;
      savedId = id;
    } else {
      const { data, error } = await supabase.rpc("create_foundation_record", {
        kind: "asset", request_id: uuidSchema.parse(formString(form, "request_id")), payload,
      });
      if (error) throw error;
      savedId = data as string;
    }
  } catch (error) { return failure(error); }
  refreshAssets();
  redirect(`/assets/${savedId}`);
}

export async function saveSite(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { supabase } = await requirePermission("assets.manage");
    const payload = siteSchema.parse(Object.fromEntries(form));
    const id = formString(form, "id");
    if (id) {
      uuidSchema.parse(id);
      const version = z.iso.datetime({ offset: true }).parse(formString(form, "updated_at"));
      const { error } = await supabase.from("sites").update(payload).eq("id", id).eq("updated_at", version).select("id").single();
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc("create_foundation_record", {
        kind: "site", request_id: uuidSchema.parse(formString(form, "request_id")), payload,
      });
      if (error) throw error;
    }
  } catch (error) { return failure(error); }
  refreshAssets();
  redirect("/sites");
}

export async function archiveRecord(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { supabase } = await requirePermission("assets.manage");
    const table = z.enum(["sites", "assets"]).parse(formString(form, "table"));
    const id = uuidSchema.parse(formString(form, "id"));
    const version = z.iso.datetime({ offset: true }).parse(formString(form, "updated_at"));
    const archived_at = z.enum(["archive", "restore"]).parse(formString(form, "operation")) === "archive" ? new Date().toISOString() : null;
    const { error } = await supabase.from(table).update({ archived_at }).eq("id", id).eq("updated_at", version).select("id").single();
    if (error) throw error;
  } catch (error) { return failure(error); }
  refreshAssets();
  return { success: "Стан архівування змінено. Історію збережено." };
}

export async function recordInspection(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { supabase } = await requirePermission("inspections.create");
    const { next_inspection_date, ...fields } = inspectionSchema.parse(Object.fromEntries(form));
    const next_inspection_at = endOfKyivDay(next_inspection_date);
    if (next_inspection_at && new Date(next_inspection_at).getTime() < Date.now()) {
      return { error: "Наступний огляд не може бути в минулому." };
    }
    const { error } = await supabase.rpc("create_foundation_record", {
      kind: "inspection", request_id: uuidSchema.parse(formString(form, "request_id")),
      payload: { ...fields, next_inspection_at },
    });
    if (error) throw error;
  } catch (error) { return failure(error); }
  refreshAssets();
  redirect(`/assets/${formString(form, "asset_id")}`);
}
