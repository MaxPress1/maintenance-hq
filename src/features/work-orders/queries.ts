import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type WorkOrder, type WorkOrderComment, type Attachment } from "./schema";

export interface WorkOrderFilters {
  status?: string;
  priority?: string;
  assetId?: string;
  responsibleId?: string;
  assignedUserId?: string;
  workType?: string;
  search?: string;
  isEmergency?: boolean;
}

export async function getWorkOrders(filters: WorkOrderFilters = {}) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("work_orders")
    .select(`
      *,
      asset:assets(id, name, type, site_id, site:sites(name)),
      responsible:profiles!work_orders_responsible_id_fkey(id, display_name),
      author:profiles!work_orders_author_id_fkey(id, display_name),
      completed_by_profile:profiles!work_orders_completed_by_fkey(id, display_name),
      assignments:work_order_assignments(user_id, user:profiles!work_order_assignments_user_id_fkey(id, display_name))
    `)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.assetId) {
    query = query.eq("asset_id", filters.assetId);
  }
  if (filters.responsibleId) {
    query = query.eq("responsible_id", filters.responsibleId);
  }
  if (filters.workType) {
    query = query.eq("work_type", filters.workType);
  }
  if (filters.isEmergency) {
    query = query.or("work_type.eq.emergency,reported_urgency.eq.critical,priority.eq.critical");
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) {
    // If table not yet in db or connection issue, return empty array in fallback
    console.error("Error fetching work orders:", error);
    return [] as WorkOrder[];
  }
  return (data ?? []) as unknown as WorkOrder[];
}

export async function getWorkOrderById(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      asset:assets(id, name, type, site_id, site:sites(name)),
      responsible:profiles!work_orders_responsible_id_fkey(id, display_name),
      author:profiles!work_orders_author_id_fkey(id, display_name),
      completed_by_profile:profiles!work_orders_completed_by_fkey(id, display_name),
      assignments:work_order_assignments(user_id, user:profiles!work_order_assignments_user_id_fkey(id, display_name))
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching work order by id:", error);
    return null;
  }
  return data as unknown as WorkOrder | null;
}

export async function getWorkOrderComments(workOrderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_order_comments")
    .select(`
      *,
      author:profiles(display_name)
    `)
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching work order comments:", error);
    return [] as WorkOrderComment[];
  }
  return (data ?? []) as unknown as WorkOrderComment[];
}

export async function getAttachments(recordType: string, recordId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attachments")
    .select(`
      *,
      uploader:profiles(display_name)
    `)
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching attachments:", error);
    return [] as Attachment[];
  }
  return (data ?? []) as unknown as Attachment[];
}

export async function getPublicReportToken(token: string) {
  const supabase = await createSupabaseServerClient();
  // We can query token directly or match by token_hash
  const { data, error } = await supabase
    .from("public_report_tokens")
    .select(`
      id,
      asset_id,
      is_active,
      expires_at,
      asset:assets(id, name, type, site:sites(name))
    `)
    .eq("token_hash", token)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }
  return data as unknown as {
    id: string;
    asset_id: string;
    is_active: boolean;
    expires_at: string | null;
    asset?: { id: string; name: string; type: string; site?: { name: string } };
  };
}
