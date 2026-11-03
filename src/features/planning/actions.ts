"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext, requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dependencySchema,
  rescheduleSchema,
  willCauseCycle,
} from "./schema";

export type PlanningActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function rescheduleWorkOrderAction(
  _prevState: PlanningActionState,
  formData: FormData
): Promise<PlanningActionState> {
  let user: { id: string };
  try {
    const perm = await requirePermission("planning.manage");
    user = perm.user;
  } catch {
    return { error: "Недостатньо прав для перенесення робіт." };
  }

  const raw = {
    work_order_id: formData.get("work_order_id"),
    new_start_date: formData.get("new_start_date"),
    new_end_date: formData.get("new_end_date"),
    reason: formData.get("reason"),
  };

  const parsed = rescheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();

  // Get current dates
  const { data: currentOrder, error: fetchError } = await supabase
    .from("work_orders")
    .select("planned_start_date, planned_end_date")
    .eq("id", parsed.data.work_order_id)
    .single();

  if (fetchError || !currentOrder) {
    return { error: "Заявку не знайдено." };
  }

  // Update work order
  const { error: updateError } = await supabase
    .from("work_orders")
    .update({
      planned_start_date: parsed.data.new_start_date,
      planned_end_date: parsed.data.new_end_date,
    })
    .eq("id", parsed.data.work_order_id);

  if (updateError) {
    return { error: updateError.message };
  }

  // Record reschedule history
  await supabase.from("work_order_reschedules").insert({
    work_order_id: parsed.data.work_order_id,
    old_start_date: currentOrder.planned_start_date,
    old_end_date: currentOrder.planned_end_date,
    new_start_date: parsed.data.new_start_date,
    new_end_date: parsed.data.new_end_date,
    reason: parsed.data.reason,
    rescheduled_by: user.id,
  });

  revalidatePath(`/work-orders/${parsed.data.work_order_id}`);
  revalidatePath("/planning");
  return { success: true };
}

export async function addDependencyAction(
  workOrderId: string,
  dependsOnWorkOrderId: string
): Promise<PlanningActionState> {
  const context = await getAccessContext();
  if (!context.permissions.includes("planning.manage")) {
    return { error: "Недостатньо прав для керування залежностями." };
  }

  const parsed = dependencySchema.safeParse({
    work_order_id: workOrderId,
    depends_on_work_order_id: dependsOnWorkOrderId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Помилка валідації" };
  }

  const supabase = context.supabase;

  // Fetch all existing dependencies to check cycles
  const { data: existingDeps } = await supabase.from("work_order_dependencies").select("*");

  if (willCauseCycle(existingDeps || [], workOrderId, dependsOnWorkOrderId)) {
    return {
      error: "Неможливо додати залежність: це створить циклічне блокування між роботами.",
    };
  }

  const { error } = await supabase.from("work_order_dependencies").insert({
    work_order_id: workOrderId,
    depends_on_work_order_id: dependsOnWorkOrderId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/planning");
  return { success: true };
}

export async function removeDependencyAction(
  workOrderId: string,
  dependsOnWorkOrderId: string
): Promise<PlanningActionState> {
  const context = await getAccessContext();
  if (!context.permissions.includes("planning.manage")) {
    return { error: "Недостатньо прав для видалення залежності." };
  }

  const { error } = await context.supabase
    .from("work_order_dependencies")
    .delete()
    .eq("work_order_id", workOrderId)
    .eq("depends_on_work_order_id", dependsOnWorkOrderId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/planning");
  return { success: true };
}
