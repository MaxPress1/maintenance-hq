import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ReportFilter } from "./schema";
import { WORK_ORDER_PRIORITY_LABELS, WORK_ORDER_STATUS_LABELS, WORK_TYPE_LABELS } from "../work-orders/schema";
import { formatDate } from "@/lib/dates";

export interface ReportResult {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export async function generateReportData(filter: ReportFilter): Promise<ReportResult> {
  const supabase = await createSupabaseServerClient();

  switch (filter.reportType) {
    case "completed_period": {
      let query = supabase
        .from("work_orders")
        .select(`
          number, title, work_type, priority, completed_at, actual_cost,
          asset:assets(name),
          responsible:profiles!work_orders_responsible_id_fkey(display_name),
          completed_by_profile:profiles!work_orders_completed_by_fkey(display_name),
          completion_result
        `)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (filter.startDate) query = query.gte("completed_at", filter.startDate);
      if (filter.endDate) query = query.lte("completed_at", filter.endDate + "T23:59:59.999Z");
      if (filter.assetId) query = query.eq("asset_id", filter.assetId);

      const { data } = await query;
      const rows = (data || []).map((wo) => {
        const item = wo as unknown as {
          number: number;
          title: string;
          asset?: { name: string };
          work_type: string;
          priority: string;
          completed_at: string | null;
          responsible?: { display_name: string };
          completed_by_profile?: { display_name: string };
          actual_cost: number;
          completion_result: string;
        };
        return [
          `#${item.number}`,
          item.title,
          item.asset?.name || "—",
          WORK_TYPE_LABELS[item.work_type as keyof typeof WORK_TYPE_LABELS] || item.work_type,
          WORK_ORDER_PRIORITY_LABELS[item.priority as keyof typeof WORK_ORDER_PRIORITY_LABELS] || item.priority,
          item.completed_at ? formatDate(item.completed_at) : "—",
          item.responsible?.display_name || "—",
          item.completed_by_profile?.display_name || "—",
          Number(item.actual_cost || 0).toFixed(2),
          item.completion_result || "",
        ];
      });

      return {
        title: "1. Виконані роботи за період",
        headers: [
          "№",
          "Назва роботи",
          "Об’єкт",
          "Тип",
          "Пріоритет",
          "Дата завершення",
          "Відповідальний",
          "Хто підтвердив",
          "Фактична вартість (₴)",
          "Результат",
        ],
        rows,
      };
    }

    case "uncompleted_overdue": {
      const nowIso = new Date().toISOString();
      let query = supabase
        .from("work_orders")
        .select(`
          number, title, status, priority, planned_end_date, deadline,
          asset:assets(name),
          responsible:profiles!work_orders_responsible_id_fkey(display_name)
        `)
        .not("status", "in", "('completed','canceled')")
        .order("planned_end_date", { ascending: true });

      if (filter.assetId) query = query.eq("asset_id", filter.assetId);

      const { data } = await query;
      const rows = (data || []).map((wo) => {
        const item = wo as unknown as {
          number: number;
          title: string;
          asset?: { name: string };
          status: string;
          priority: string;
          planned_end_date: string | null;
          deadline: string | null;
          responsible?: { display_name: string };
        };
        const isOverdue =
          (item.planned_end_date && item.planned_end_date < nowIso.slice(0, 10)) ||
          (item.deadline && item.deadline < nowIso);

        return [
          `#${item.number}`,
          item.title,
          item.asset?.name || "—",
          WORK_ORDER_STATUS_LABELS[item.status as keyof typeof WORK_ORDER_STATUS_LABELS] || item.status,
          WORK_ORDER_PRIORITY_LABELS[item.priority as keyof typeof WORK_ORDER_PRIORITY_LABELS] || item.priority,
          item.planned_end_date ? formatDate(item.planned_end_date) : "—",
          item.responsible?.display_name || "Не призначено",
          isOverdue ? "ТАК (Прострочено)" : "Ні",
        ];
      });

      return {
        title: "2. Невиконані та прострочені роботи",
        headers: [
          "№",
          "Назва роботи",
          "Об’єкт",
          "Статус",
          "Пріоритет",
          "Планова дата завершення",
          "Відповідальний",
          "Прострочено?",
        ],
        rows,
      };
    }

    case "emergency_works": {
      let query = supabase
        .from("work_orders")
        .select(`
          number, title, work_type, priority, status, created_at, source,
          asset:assets(name),
          responsible:profiles!work_orders_responsible_id_fkey(display_name),
          author:profiles!work_orders_author_id_fkey(display_name)
        `)
        .or("work_type.eq.emergency,reported_urgency.eq.critical,priority.eq.critical")
        .order("created_at", { ascending: false });

      if (filter.startDate) query = query.gte("created_at", filter.startDate);
      if (filter.endDate) query = query.lte("created_at", filter.endDate + "T23:59:59.999Z");
      if (filter.assetId) query = query.eq("asset_id", filter.assetId);

      const { data } = await query;
      const rows = (data || []).map((wo) => {
        const item = wo as unknown as {
          number: number;
          title: string;
          source: string;
          status: string;
          created_at: string;
          asset?: { name: string };
          responsible?: { display_name: string };
          author?: { display_name: string };
        };
        return [
          `#${item.number}`,
          item.title,
          item.asset?.name || "—",
          item.source === "public" ? "Публічна форма" : "Внутрішня",
          WORK_ORDER_STATUS_LABELS[item.status as keyof typeof WORK_ORDER_STATUS_LABELS] || item.status,
          formatDate(item.created_at),
          item.responsible?.display_name || "Не призначено",
          item.author?.display_name || "Заявник",
        ];
      });

      return {
        title: "3. Аварійні та термінові роботи",
        headers: [
          "№",
          "Назва аварії",
          "Об’єкт",
          "Джерело",
          "Статус",
          "Дата створення",
          "Відповідальний",
          "Автор",
        ],
        rows,
      };
    }

    case "expenses_by_asset": {
      const { data: assets } = await supabase.from("assets").select("id, name, type, site:sites(name)");
      const { data: transactions } = await supabase
        .from("budget_transactions")
        .select(`
          amount_uah,
          work_order:work_orders(asset_id)
        `)
        .eq("status", "posted");

      const assetMap = new Map<string, number>();
      for (const tx of transactions || []) {
        const item = tx as unknown as { amount_uah: number; work_order?: { asset_id: string } };
        const assetId = item.work_order?.asset_id || "unassigned";
        assetMap.set(assetId, (assetMap.get(assetId) || 0) + Number(item.amount_uah || 0));
      }

      const rows = (assets || []).map((asset) => {
        const a = asset as unknown as { id: string; name: string; type: string; site?: { name: string } };
        return [
          a.name,
          a.site?.name || "—",
          a.type,
          (assetMap.get(a.id) || 0).toFixed(2),
        ];
      });

      return {
        title: "4. Витрати за об’єктами території",
        headers: ["Назва об’єкта", "Територія", "Тип", "Фактичні витрати (₴ UAH)"],
        rows,
      };
    }

    case "expenses_by_month": {
      const year = filter.year || new Date().getFullYear();
      const { data: transactions } = await supabase
        .from("budget_transactions")
        .select("amount_uah, created_at, category")
        .eq("status", "posted")
        .gte("created_at", `${year}-01-01T00:00:00.000Z`)
        .lte("created_at", `${year}-12-31T23:59:59.999Z`);

      const monthlyMap = Array.from({ length: 12 }, () => 0);
      for (const tx of transactions || []) {
        const month = new Date(tx.created_at).getMonth(); // 0-11
        monthlyMap[month] += Number(tx.amount_uah || 0);
      }

      const monthNames = [
        "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
        "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
      ];

      const rows = monthNames.map((name, idx) => [
        `${name} ${year}`,
        monthlyMap[idx].toFixed(2),
      ]);

      return {
        title: `5. Витрати за місяцями (${year})`,
        headers: ["Місяць", "Фактичні витрати (₴ UAH)"],
        rows,
      };
    }

    case "plan_vs_fact": {
      const year = filter.year || new Date().getFullYear();
      let query = supabase
        .from("work_orders")
        .select(`
          number, title, planned_cost, approved_budget, actual_cost, status,
          asset:assets(name)
        `)
        .order("number", { ascending: true });

      if (filter.assetId) query = query.eq("asset_id", filter.assetId);

      const { data } = await query;
      const rows = (data || []).map((wo) => {
        const item = wo as unknown as {
          number: number;
          title: string;
          planned_cost: number;
          approved_budget: number;
          actual_cost: number;
          status: string;
          asset?: { name: string };
        };
        const planned = Number(item.planned_cost || 0);
        const approved = Number(item.approved_budget || 0);
        const fact = Number(item.actual_cost || 0);
        const variance = Math.round((approved - fact) * 100) / 100;

        return [
          `#${item.number}`,
          item.title,
          item.asset?.name || "—",
          planned.toFixed(2),
          approved.toFixed(2),
          fact.toFixed(2),
          variance.toFixed(2),
          WORK_ORDER_STATUS_LABELS[item.status as keyof typeof WORK_ORDER_STATUS_LABELS] || item.status,
        ];
      });

      return {
        title: `6. Порівняльний звіт: План vs Погоджено vs Факт (${year})`,
        headers: [
          "№",
          "Назва роботи",
          "Об’єкт",
          "План (₴)",
          "Погоджено (₴)",
          "Факт (₴)",
          "Відхилення (₴)",
          "Статус",
        ],
        rows,
      };
    }
  }
}
