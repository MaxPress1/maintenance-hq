"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/ui/action-form";
import { AccessDeniedError, requirePermission } from "@/lib/auth/permissions";
import { authErrorMessage } from "@/lib/auth/errors";
import { activeUpdateSchema, callbackUrl, invitationSchema, roleUpdateSchema } from "@/lib/auth/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function administrationError(error: unknown): ActionState {
  if (error instanceof AccessDeniedError) return { error: error.message };
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "42501") return { error: "Недостатньо прав. Оновіть сторінку або зверніться до адміністратора." };
    if (error.code === "23514") return { error: "Не можна вимкнути або позбавити ролі останнього активного адміністратора." };
    if (error.code === "22023") return { error: "Користувача або роль не знайдено. Оновіть сторінку." };
  }
  throw error;
}

export async function inviteUserAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission("users.invite");
    const { supabase } = await requirePermission("roles.manage");
    const input = invitationSchema.safeParse({
      email: formData.get("email"), displayName: formData.get("displayName"), roles: formData.getAll("roles"),
    });
    if (!input.success) return { error: "Перевірте електронну адресу, ім’я (до 200 символів) та оберіть хоча б одну роль." };
    const redirectTo = callbackUrl();
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.data.email, {
      data: { display_name: input.data.displayName }, redirectTo,
    });
    if (error) return { error: authErrorMessage(error) };
    if (!data.user) throw new Error("Auth invitation returned no user.");
    try {
      const { error: rolesError } = await supabase.rpc("set_user_roles", {
        target_user_id: data.user.id, role_codes: input.data.roles,
      });
      if (rolesError) throw rolesError;
    } catch (error) {
      console.error("Invitation created; role assignment failed", {
        userId: data.user.id,
        code: error && typeof error === "object" && "code" in error ? error.code : "unexpected_error",
      });
      revalidatePath("/settings");
      return { error: `Запрошення вже створено й лист надіслано, але призначення ролей не підтверджено (користувач ${data.user.id}). Не надсилайте повторне запрошення: оновіть список, перевірте поточні ролі та за потреби призначте їх окремо. Без ролей доступ закритий. Якщо збій повторюється, зверніться до підтримки.` };
    }
    revalidatePath("/settings");
    return { success: "Запрошення надіслано, ролі призначено. Користувач встановить пароль за посиланням у листі." };
  } catch (error) {
    return administrationError(error);
  }
}

export async function updateUserRolesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await requirePermission("roles.manage");
    const input = roleUpdateSchema.safeParse({ userId: formData.get("userId"), roles: formData.getAll("roles") });
    if (!input.success) return { error: "Некоректний користувач або набір ролей." };
    const { error } = await supabase.rpc("set_user_roles", { target_user_id: input.data.userId, role_codes: input.data.roles });
    if (error) throw error;
    revalidatePath("/settings");
    return { success: input.data.roles.length ? "Ролі збережено." : "Ролі знято. Доступ користувача закритий." };
  } catch (error) {
    return administrationError(error);
  }
}

export async function updateUserActiveAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await requirePermission("roles.manage");
    const input = activeUpdateSchema.safeParse({ userId: formData.get("userId"), active: formData.get("active") });
    if (!input.success) return { error: "Некоректний користувач або стан активності." };
    const { error } = await supabase.rpc("set_profile_active", { target_user_id: input.data.userId, active: input.data.active === "true" });
    if (error) throw error;
    revalidatePath("/settings");
    return { success: "Стан користувача змінено." };
  } catch (error) {
    return administrationError(error);
  }
}