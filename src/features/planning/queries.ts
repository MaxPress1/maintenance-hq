import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type WorkOrderDependency, type WorkOrderReschedule } from "./schema";

export async function getWorkOrderDependencies(workOrderId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("work_order_dependencies").select("*");
  if (workOrderId) {
    query = query.or(`work_order_id.eq.${workOrderId},depends_on_work_order_id.eq.${workOrderId}`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching dependencies:", error);
    return [] as WorkOrderDependency[];
  }
  return (data ?? []) as WorkOrderDependency[];
}

export async function getWorkOrderReschedules(workOrderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_order_reschedules")
    .select(`
      *,
      rescheduler:profiles(display_name)
    `)
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reschedules:", error);
    return [] as WorkOrderReschedule[];
  }
  return (data ?? []) as WorkOrderReschedule[];
}
