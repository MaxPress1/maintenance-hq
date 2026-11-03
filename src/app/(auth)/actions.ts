"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/action-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth/errors";
import { AccessDeniedError, getAccessContext, redirectAccessError, requireSession } from "@/lib/auth/permissions";
import { callbackUrl, emailSchema, loginSchema, setPasswordSchema } from "@/lib/auth/validation";

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const input = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!input.success) return { error: "Вкажіть коректну електронну адресу та пароль." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);
  if (error) return { error: authErrorMessage(error) };
  try {
    await getAccessContext();
  } catch (error) {
    redirectAccessError(error);
  }
  redirect("/");
}

export async function logoutAction(): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { error: authErrorMessage(error) };
  redirect("/login");
}

export async function recoveryAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const input = emailSchema.safeParse(formData.get("email"));
  if (!input.success) return { error: "Вкажіть коректну електронну адресу." };
  const redirectTo = callbackUrl();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.data, { redirectTo });
  if (error) return { error: authErrorMessage(error) };
  return { success: "Якщо обліковий запис існує, на адресу надійде лист для відновлення доступу." };
}

export async function setPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const input = setPasswordSchema.safeParse({ password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Перевірте пароль." };
  try {
    const { supabase } = await requireSession();
    const { error } = await supabase.auth.updateUser({ password: input.data.password });
    if (error) return { error: authErrorMessage(error) };
  } catch (error) {
    if (error instanceof AccessDeniedError) return { error: "Сесія закінчилася. Отримайте нове посилання для відновлення доступу." };
    throw error;
  }
  try {
    await getAccessContext();
  } catch (error) {
    redirectAccessError(error);
  }
  redirect("/");
}