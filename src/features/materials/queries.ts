import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type Material, type MaterialRequest, type MaterialUsage } from "./schema";

export async function getMaterials() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching materials:", error);
    return [] as Material[];
  }
  return (data ?? []) as Material[];
}

export async function getMaterialRequests(workOrderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("material_requests")
    .select(`
      *,
      material:materials(*)
    `)
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching material requests:", error);
    return [] as MaterialRequest[];
  }
  return (data ?? []) as MaterialRequest[];
}

export async function getMaterialUsages(workOrderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("material_usages")
    .select(`
      *,
      material:materials(*),
      user:profiles(display_name)
    `)
    .eq("work_order_id", workOrderId)
    .order("used_at", { ascending: true });

  if (error) {
    console.error("Error fetching material usages:", error);
    return [] as MaterialUsage[];
  }
  return (data ?? []) as MaterialUsage[];
}
