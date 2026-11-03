"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext, requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  materialSchema,
  materialUsageSchema,
  stockAdjustmentSchema,
} from "./schema";

export type MaterialActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createMaterialAction(
  _prevState: MaterialActionState,
  formData: FormData
): Promise<MaterialActionState> {
  try {
    await requirePermission("materials.manage");
  } catch {
    return { error: "Недостатньо прав для додавання матеріалів." };
  }

  const raw = {
    name: formData.get("name"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    estimated_price: formData.get("estimated_price"),
    stock_quantity: formData.get("stock_quantity"),
    min_stock_level: formData.get("min_stock_level"),
    supplier: formData.get("supplier"),
  };

  const parsed = materialSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("materials").insert({
    name: parsed.data.name,
    category: parsed.data.category,
    unit: parsed.data.unit,
    estimated_price: parsed.data.estimated_price,
    stock_quantity: parsed.data.stock_quantity,
    min_stock_level: parsed.data.min_stock_level,
    supplier: parsed.data.supplier,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/materials");
  return { success: true };
}

export async function adjustMaterialStockAction(
  _prevState: MaterialActionState,
  formData: FormData
): Promise<MaterialActionState> {
  const context = await getAccessContext();
  if (!context.permissions.includes("materials.manage")) {
    return { error: "Недостатньо прав для коригування залишків." };
  }

  const raw = {
    material_id: formData.get("material_id"),
    delta: formData.get("delta"),
    reason: formData.get("reason"),
  };

  const parsed = stockAdjustmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = context.supabase;

  // Get current stock
  const { data: currentMat, error: fetchErr } = await supabase
    .from("materials")
    .select("stock_quantity")
    .eq("id", parsed.data.material_id)
    .single();

  if (fetchErr || !currentMat) {
    return { error: "Матеріал не знайдено." };
  }

  const newStock = Math.max(0, currentMat.stock_quantity + parsed.data.delta);

  // Update stock
  const { error: updateErr } = await supabase
    .from("materials")
    .update({ stock_quantity: newStock })
    .eq("id", parsed.data.material_id);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // Record audit adjustment
  await supabase.from("material_stock_adjustments").insert({
    material_id: parsed.data.material_id,
    delta: parsed.data.delta,
    reason: parsed.data.reason,
    adjusted_by: context.user.id,
  });

  revalidatePath("/materials");
  return { success: true };
}

export async function recordMaterialUsageAction(
  _prevState: MaterialActionState,
  formData: FormData
): Promise<MaterialActionState> {
  const context = await getAccessContext();
  const raw = {
    work_order_id: formData.get("work_order_id"),
    material_id: formData.get("material_id"),
    used_quantity: formData.get("used_quantity"),
  };

  const parsed = materialUsageSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = context.supabase;

  // Record usage
  const { error: usageErr } = await supabase.from("material_usages").insert({
    work_order_id: parsed.data.work_order_id,
    material_id: parsed.data.material_id,
    used_quantity: parsed.data.used_quantity,
    used_by: context.user.id,
  });

  if (usageErr) {
    return { error: usageErr.message };
  }

  // Deduct from material stock
  const { data: currentMat } = await supabase
    .from("materials")
    .select("stock_quantity")
    .eq("id", parsed.data.material_id)
    .single();

  if (currentMat) {
    const newStock = Math.max(0, currentMat.stock_quantity - parsed.data.used_quantity);
    await supabase.from("materials").update({ stock_quantity: newStock }).eq("id", parsed.data.material_id);
  }

  revalidatePath(`/work-orders/${parsed.data.work_order_id}`);
  revalidatePath("/materials");
  return { success: true };
}
