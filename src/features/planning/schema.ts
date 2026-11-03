import { z } from "zod";

export interface WorkOrderDependency {
  work_order_id: string;
  depends_on_work_order_id: string;
  created_at: string;
}

export interface WorkOrderReschedule {
  id: string;
  work_order_id: string;
  old_start_date: string | null;
  old_end_date: string | null;
  new_start_date: string | null;
  new_end_date: string | null;
  reason: string;
  rescheduled_by: string | null;
  created_at: string;
  rescheduler?: { display_name: string };
}

export const rescheduleSchema = z.object({
  work_order_id: z.string().uuid(),
  new_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Невірний формат дати").nullable().optional().or(z.literal("")).transform((v) => v || null),
  new_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Невірний формат дати").nullable().optional().or(z.literal("")).transform((v) => v || null),
  reason: z.string().trim().min(3, "Вкажіть причину перенесення (мінімум 3 символи)").max(2000),
}).refine(
  (data) => {
    if (data.new_start_date && data.new_end_date) {
      return data.new_end_date >= data.new_start_date;
    }
    return true;
  },
  { message: "Дата завершення не може бути раніше дати початку", path: ["new_end_date"] }
);

export const dependencySchema = z.object({
  work_order_id: z.string().uuid(),
  depends_on_work_order_id: z.string().uuid(),
}).refine((data) => data.work_order_id !== data.depends_on_work_order_id, {
  message: "Робота не може залежати сама від себе",
  path: ["depends_on_work_order_id"],
});

/**
 * Checks if adding an edge (from -> to) would introduce a cycle in a directed graph of dependencies.
 * where edge (A -> B) means A depends on B.
 */
export function willCauseCycle(
  existingDependencies: { work_order_id: string; depends_on_work_order_id: string }[],
  newWorkOrderId: string,
  newDependsOnId: string
): boolean {
  if (newWorkOrderId === newDependsOnId) return true;

  // Build adjacency list: target -> array of things it depends on
  const adj = new Map<string, string[]>();
  for (const dep of existingDependencies) {
    if (!adj.has(dep.work_order_id)) {
      adj.set(dep.work_order_id, []);
    }
    adj.get(dep.work_order_id)!.push(dep.depends_on_work_order_id);
  }

  // Add the proposed new edge
  if (!adj.has(newWorkOrderId)) {
    adj.set(newWorkOrderId, []);
  }
  adj.get(newWorkOrderId)!.push(newDependsOnId);

  // DFS from newDependsOnId to check if we can reach newWorkOrderId
  const visited = new Set<string>();
  const queue = [newDependsOnId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === newWorkOrderId) {
      return true; // Cycle detected!
    }
    if (!visited.has(current)) {
      visited.add(current);
      const neighbors = adj.get(current) || [];
      for (const next of neighbors) {
        if (next === newWorkOrderId) return true;
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  return false;
}
