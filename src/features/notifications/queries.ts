import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export async function getUserNotifications() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult?.user) return [] as NotificationItem[];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userResult.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [] as NotificationItem[];
  }
  return (data ?? []) as NotificationItem[];
}
