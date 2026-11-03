"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/auth/permissions";

export async function markNotificationAsReadAction(notificationId: string) {
  const context = await getAccessContext();
  await context.supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", context.user.id);

  revalidatePath("/");
  return { success: true };
}
