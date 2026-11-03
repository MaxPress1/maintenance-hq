"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext, requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  allocationSchema,
  annualBudgetSchema,
  budgetTransactionSchema,
  calculateUahEquivalent,
} from "./schema";

export type FinanceActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function saveAnnualBudgetAction(
  _prevState: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  try {
    await requirePermission("finance.manage");
  } catch {
    return { error: "Недостатньо прав для збереження бюджету." };
  }

  const raw = {
    site_id: formData.get("site_id"),
    year: formData.get("year"),
    planned_amount: formData.get("planned_amount"),
    reserve_amount: formData.get("reserve_amount"),
  };

  const parsed = annualBudgetSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("annual_budgets")
    .select("id")
    .eq("year", parsed.data.year);

  if (parsed.data.site_id) {
    query = query.eq("site_id", parsed.data.site_id);
  } else {
    query = query.is("site_id", null);
  }

  const { data: existingBudget, error: fetchError } = await query.maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (existingBudget) {
    const { error: updateError } = await supabase
      .from("annual_budgets")
      .update({
        planned_amount: parsed.data.planned_amount,
        reserve_amount: parsed.data.reserve_amount,
      })
      .eq("id", existingBudget.id);

    if (updateError) {
      return { error: updateError.message };
    }
  } else {
    const { error: insertError } = await supabase
      .from("annual_budgets")
      .insert({
        site_id: parsed.data.site_id,
        year: parsed.data.year,
        planned_amount: parsed.data.planned_amount,
        reserve_amount: parsed.data.reserve_amount,
      });

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/budget");
  revalidatePath("/");
  return { success: true };
}

export async function createBudgetTransactionAction(
  _prevState: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  let user: { id: string };
  try {
    const perm = await requirePermission("finance.manage");
    user = perm.user;
  } catch {
    return { error: "Недостатньо прав для додавання фінансових операцій." };
  }

  const raw = {
    work_order_id: formData.get("work_order_id"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "UAH",
    exchange_rate_to_uah: formData.get("exchange_rate_to_uah") || "1.0",
    description: formData.get("description"),
  };

  const parsed = budgetTransactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const amountUah = calculateUahEquivalent(
    parsed.data.amount,
    parsed.data.exchange_rate_to_uah
  );

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("budget_transactions").insert({
    work_order_id: parsed.data.work_order_id,
    category: parsed.data.category,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    exchange_rate_to_uah: parsed.data.exchange_rate_to_uah,
    amount_uah: amountUah,
    description: parsed.data.description,
    status: "posted",
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  if (parsed.data.work_order_id) {
    revalidatePath(`/work-orders/${parsed.data.work_order_id}`);
  }
  revalidatePath("/budget");
  revalidatePath("/");
  return { success: true };
}

export async function stornoTransactionAction(
  transactionId: string,
  stornoReason: string
): Promise<FinanceActionState> {
  const context = await getAccessContext();
  if (!context.permissions.includes("finance.manage")) {
    return { error: "Недостатньо прав для виконання сторно." };
  }

  if (!stornoReason.trim()) {
    return { error: "Вкажіть причину сторнування операції." };
  }

  const supabase = context.supabase;

  // Fetch original transaction
  const { data: original, error: fetchErr } = await supabase
    .from("budget_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (fetchErr || !original) {
    return { error: "Оригінальну операцію не знайдено." };
  }

  if (original.is_storno) {
    return { error: "Неможливо сторнувати сторно-запис." };
  }

  // Check if already stornoed
  const { data: existingStorno } = await supabase
    .from("budget_transactions")
    .select("id")
    .eq("storno_for_id", transactionId)
    .maybeSingle();

  if (existingStorno) {
    return { error: "Ця операція вже була відсторнована раніше." };
  }

  // Create storno (reversing) transaction with negative amount
  const { error: insertErr } = await supabase.from("budget_transactions").insert({
    work_order_id: original.work_order_id,
    category: original.category,
    amount: -original.amount,
    currency: original.currency,
    exchange_rate_to_uah: original.exchange_rate_to_uah,
    amount_uah: -original.amount_uah,
    description: `Сторно: ${stornoReason.trim()} (до оп. #${original.id.slice(0, 8)})`,
    is_storno: true,
    storno_for_id: original.id,
    status: "posted",
    created_by: context.user.id,
  });

  if (insertErr) {
    return { error: insertErr.message };
  }

  if (original.work_order_id) {
    revalidatePath(`/work-orders/${original.work_order_id}`);
  }
  revalidatePath("/budget");
  revalidatePath("/");
  return { success: true };
}

export async function allocateBudgetAction(
  _prevState: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  try {
    await requirePermission("finance.manage");
  } catch {
    return { error: "Недостатньо прав для погодження бюджету." };
  }

  const raw = {
    work_order_id: formData.get("work_order_id"),
    budget_year: formData.get("budget_year"),
    approved_amount: formData.get("approved_amount"),
  };

  const parsed = allocationSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_order_allocations").insert({
    work_order_id: parsed.data.work_order_id,
    budget_year: parsed.data.budget_year,
    approved_amount: parsed.data.approved_amount,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/work-orders/${parsed.data.work_order_id}`);
  revalidatePath("/budget");
  revalidatePath("/");
  return { success: true };
}
