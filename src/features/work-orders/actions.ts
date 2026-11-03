"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessContext, requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canTransitionWorkOrder,
  emergencyReportSchema,
  publicReportSchema,
  workOrderCommentSchema,
  workOrderCreateSchema,
  type WorkOrderStatus,
} from "./schema";

export type ActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  id?: string;
};

export async function createWorkOrderAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let user: { id: string };
  try {
    const perm = await requirePermission("work_orders.read");
    user = perm.user;
  } catch {
    return { error: "Недостатньо прав для створення заявки." };
  }

  const raw = {
    title: formData.get("title"),
    description: formData.get("description"),
    asset_id: formData.get("asset_id"),
    work_type: formData.get("work_type"),
    reported_urgency: formData.get("reported_urgency"),
    priority: formData.get("priority"),
    responsible_id: formData.get("responsible_id"),
    planned_start_date: formData.get("planned_start_date"),
    planned_end_date: formData.get("planned_end_date"),
    planned_cost: formData.get("planned_cost"),
  };

  const parsed = workOrderCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      asset_id: parsed.data.asset_id,
      work_type: parsed.data.work_type,
      reported_urgency: parsed.data.reported_urgency,
      priority: parsed.data.priority,
      status: parsed.data.responsible_id ? "scheduled" : "new",
      responsible_id: parsed.data.responsible_id,
      planned_start_date: parsed.data.planned_start_date,
      planned_end_date: parsed.data.planned_end_date,
      planned_cost: parsed.data.planned_cost,
      author_id: user.id,
      source: "internal",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error creating work order:", error);
    return { error: error?.message || "Не вдалося зберегти заявку." };
  }

  revalidatePath("/work-orders");
  revalidatePath("/");
  redirect(`/work-orders/${data.id}`);
}

export async function createEmergencyReportAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let user: { id: string };
  try {
    const perm = await requirePermission("work_orders.read");
    user = perm.user;
  } catch {
    return { error: "Недостатньо прав для створення заявки." };
  }

  const raw = {
    asset_id: formData.get("asset_id"),
    description: formData.get("description"),
    reported_urgency: formData.get("reported_urgency") || "critical",
    contact: formData.get("contact") || "",
  };

  const parsed = emergencyReportSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const title = `Аварія: ${parsed.data.description.slice(0, 60)}${parsed.data.description.length > 60 ? "..." : ""}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      title,
      description: parsed.data.description + (parsed.data.contact ? `\nКонтакт заявника: ${parsed.data.contact}` : ""),
      asset_id: parsed.data.asset_id,
      work_type: "emergency",
      reported_urgency: parsed.data.reported_urgency,
      priority: parsed.data.reported_urgency === "critical" ? "critical" : "high",
      status: "new",
      author_id: user.id,
      source: "internal",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error creating emergency report:", error);
    return { error: error?.message || "Не вдалося зареєструвати аварійну заявку." };
  }

  revalidatePath("/work-orders");
  revalidatePath("/");
  return { success: true, id: data.id };
}

export async function submitPublicReportAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const raw = {
    token: formData.get("token"),
    description: formData.get("description"),
    reported_urgency: formData.get("reported_urgency") || "high",
    contact_info: formData.get("contact_info") || "",
  };

  const parsed = publicReportSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  // Find token
  const { data: tokenData, error: tokenError } = await supabase
    .from("public_report_tokens")
    .select("asset_id, is_active, expires_at")
    .eq("token_hash", parsed.data.token)
    .maybeSingle();

  if (tokenError || !tokenData || !tokenData.is_active) {
    return { error: "Посилання недійсне або було відкликане адміністратором." };
  }

  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    return { error: "Термін дії посилання закінчився." };
  }

  const title = `Публічна заявка: ${parsed.data.description.slice(0, 60)}${parsed.data.description.length > 60 ? "..." : ""}`;

  const fullDescription = parsed.data.description + (parsed.data.contact_info ? `\nКонтакт заявника: ${parsed.data.contact_info}` : "");

  const { data: newOrder, error: insertError } = await supabase
    .from("work_orders")
    .insert({
      title,
      description: fullDescription,
      asset_id: tokenData.asset_id,
      work_type: parsed.data.reported_urgency === "critical" ? "emergency" : "unplanned",
      reported_urgency: parsed.data.reported_urgency,
      priority: parsed.data.reported_urgency === "critical" ? "critical" : "medium",
      status: "new",
      source: "public",
    })
    .select("number")
    .single();

  if (insertError || !newOrder) {
    console.error("Error creating public work order:", insertError);
    return { error: "Не вдалося зберегти заявку. Спробуйте пізніше." };
  }

  return { success: true, id: String(newOrder.number) };
}

export async function transitionWorkOrderStatusAction(
  workOrderId: string,
  targetStatus: WorkOrderStatus,
  completionResult?: string
): Promise<ActionState> {
  const context = await getAccessContext();
  const supabase = context.supabase;

  const { data: currentOrder, error: fetchError } = await supabase
    .from("work_orders")
    .select("id, status, responsible_id, version, actual_start_date, assignments:work_order_assignments(user_id)")
    .eq("id", workOrderId)
    .single();

  if (fetchError || !currentOrder) {
    return { error: "Заявку не знайдено." };
  }

  const isAssigned =
    currentOrder.responsible_id === context.user.id ||
    currentOrder.assignments?.some((a: { user_id: string }) => a.user_id === context.user.id);

  const transitionCheck = canTransitionWorkOrder(
    currentOrder.status as WorkOrderStatus,
    targetStatus,
    context.roles,
    Boolean(isAssigned),
    Boolean(currentOrder.responsible_id)
  );

  if (!transitionCheck.allowed) {
    return { error: transitionCheck.reason || "Перехід недозволений." };
  }

  const updates: Record<string, unknown> = {
    status: targetStatus,
    version: currentOrder.version + 1,
  };

  if (targetStatus === "in_progress" && !currentOrder.actual_start_date) {
    updates.actual_start_date = new Date().toISOString();
  }

  if (targetStatus === "completed") {
    if (!completionResult || completionResult.trim().length === 0) {
      return { error: "Для завершення роботи обов'язково вкажіть результат виконання." };
    }
    updates.completed_at = new Date().toISOString();
    updates.completed_by = context.user.id;
    updates.completion_result = completionResult.trim();
  }

  const { error: updateError } = await supabase
    .from("work_orders")
    .update(updates)
    .eq("id", workOrderId)
    .eq("version", currentOrder.version);

  if (updateError) {
    console.error("Error updating status:", updateError);
    return { error: "Не вдалося оновити статус або виник конфлікт версій." };
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  revalidatePath("/");
  return { success: true };
}

export async function assignWorkOrderAction(
  workOrderId: string,
  responsibleId: string | null,
  assignedUserIds: string[] = []
): Promise<ActionState> {
  const context = await getAccessContext();
  if (!context.permissions.includes("work_orders.manage")) {
    return { error: "Недостатньо прав для призначення виконавців." };
  }

  const supabase = context.supabase;

  const { error: updateError } = await supabase
    .from("work_orders")
    .update({ responsible_id: responsibleId })
    .eq("id", workOrderId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Update assignments
  await supabase.from("work_order_assignments").delete().eq("work_order_id", workOrderId);

  if (assignedUserIds.length > 0) {
    const rows = assignedUserIds.map((userId) => ({
      work_order_id: workOrderId,
      user_id: userId,
      assigned_by: context.user.id,
    }));
    const { error: assignError } = await supabase.from("work_order_assignments").insert(rows);
    if (assignError) {
      return { error: assignError.message };
    }
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  return { success: true };
}

export async function addWorkOrderCommentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await getAccessContext();
  const raw = {
    work_order_id: formData.get("work_order_id"),
    content: formData.get("content"),
  };

  const parsed = workOrderCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await context.supabase.from("work_order_comments").insert({
    work_order_id: parsed.data.work_order_id,
    author_id: context.user.id,
    content: parsed.data.content,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/work-orders/${parsed.data.work_order_id}`);
  return { success: true };
}

export async function createPublicReportTokenAction(assetId: string): Promise<ActionState> {
  const context = await getAccessContext();
  if (!context.permissions.includes("work_orders.manage") && !context.permissions.includes("assets.manage")) {
    return { error: "Недостатньо прав для створення токена." };
  }

  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const tokenHash = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  const { data, error } = await context.supabase
    .from("public_report_tokens")
    .insert({
      asset_id: assetId,
      token_hash: tokenHash,
      is_active: true,
    })
    .select("token_hash")
    .single();

  if (error || !data) {
    return { error: error?.message || "Не вдалося згенерувати посилання." };
  }

  revalidatePath(`/assets/${assetId}`);
  return { success: true, id: data.token_hash };
}
