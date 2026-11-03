import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type AnnualBudget,
  type BudgetTransaction,
  type WorkOrderAllocation,
} from "./schema";

export async function getAnnualBudgets(year?: number) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("annual_budgets")
    .select(`
      *,
      site:sites(name)
    `)
    .order("year", { ascending: false });

  if (year) {
    query = query.eq("year", year);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching annual budgets:", error);
    return [] as AnnualBudget[];
  }
  return (data ?? []) as AnnualBudget[];
}

export async function getBudgetTransactions(workOrderId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("budget_transactions")
    .select(`
      *,
      creator:profiles(display_name),
      work_order:work_orders(id, number, title)
    `)
    .order("created_at", { ascending: false });

  if (workOrderId) {
    query = query.eq("work_order_id", workOrderId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching transactions:", error);
    return [] as BudgetTransaction[];
  }
  return (data ?? []) as BudgetTransaction[];
}

export async function getWorkOrderAllocations(year?: number) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("work_order_allocations").select("*");
  if (year) {
    query = query.eq("budget_year", year);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching allocations:", error);
    return [] as WorkOrderAllocation[];
  }
  return (data ?? []) as WorkOrderAllocation[];
}
