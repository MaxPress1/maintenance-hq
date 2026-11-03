import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "materials",
  "labor",
  "delivery",
  "equipment_rental",
  "contractors",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  materials: "Матеріали",
  labor: "Оплата праці",
  delivery: "Доставка / Транспорт",
  equipment_rental: "Оренда інструментів та техніки",
  contractors: "Послуги підрядників",
  other: "Інше",
};

export const SUPPORTED_CURRENCIES = ["UAH", "USD", "EUR", "PLN", "GBP"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface AnnualBudget {
  id: string;
  site_id: string | null;
  year: number;
  planned_amount: number;
  reserve_amount: number;
  created_at: string;
  updated_at: string;
  site?: { name: string };
}

export interface WorkOrderAllocation {
  id: string;
  work_order_id: string;
  budget_year: number;
  approved_amount: number;
  created_at: string;
}

export interface BudgetTransaction {
  id: string;
  work_order_id: string | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  exchange_rate_to_uah: number;
  amount_uah: number;
  description: string;
  is_storno: boolean;
  storno_for_id: string | null;
  status: "draft" | "approved" | "posted";
  created_by: string | null;
  created_at: string;
  creator?: { display_name: string };
  work_order?: { id: string; number: number; title: string };
}

export function calculateUahEquivalent(amount: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return 0;
  // Decimal rounding to 2 places (kopecks)
  return Math.round(amount * exchangeRate * 100) / 100;
}

export interface BudgetSummary {
  plannedAmount: number;
  reserveAmount: number;
  allocatedAmount: number;
  actualSpent: number;
  freeBudget: number; // plannedAmount - allocatedAmount
  availableForAllocation: number; // freeBudget - reserveAmount
  hasOverrun: boolean;
  overrunAmount: number;
}

export function calculateBudgetSummary(
  annualBudget: { planned_amount: number; reserve_amount: number } | null,
  allocations: { approved_amount: number }[],
  transactions: { amount_uah: number; status: string }[]
): BudgetSummary {
  const planned = annualBudget?.planned_amount || 0;
  const reserve = annualBudget?.reserve_amount || 0;

  const allocated = allocations.reduce((sum, a) => sum + (Number(a.approved_amount) || 0), 0);

  const spent = transactions
    .filter((t) => t.status === "posted")
    .reduce((sum, t) => sum + (Number(t.amount_uah) || 0), 0);

  const freeBudget = Math.round((planned - allocated) * 100) / 100;
  const availableForAllocation = Math.round((freeBudget - reserve) * 100) / 100;

  const overrunAmount = allocated > 0 && spent > allocated ? Math.round((spent - allocated) * 100) / 100 : 0;

  return {
    plannedAmount: planned,
    reserveAmount: reserve,
    allocatedAmount: Math.round(allocated * 100) / 100,
    actualSpent: Math.round(spent * 100) / 100,
    freeBudget,
    availableForAllocation,
    hasOverrun: overrunAmount > 0,
    overrunAmount,
  };
}

export const annualBudgetSchema = z.object({
  site_id: z.string().uuid().nullable().optional().or(z.literal("")).transform((v) => v || null),
  year: z.coerce.number().int().min(2020).max(2100),
  planned_amount: z.coerce.number().min(0, "Бюджет не може бути від'ємним"),
  reserve_amount: z.coerce.number().min(0, "Резерв не може бути від'ємним").default(0),
}).refine((data) => data.reserve_amount <= data.planned_amount, {
  message: "Резерв не може перевищувати загальний запланований бюджет",
  path: ["reserve_amount"],
});

export const budgetTransactionSchema = z.object({
  work_order_id: z.string().uuid().nullable().optional().or(z.literal("")).transform((v) => v || null),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().refine((v) => v !== 0, "Сума операції не може дорівнювати нулю"),
  currency: z.string().min(3).max(3).default("UAH"),
  exchange_rate_to_uah: z.coerce.number().positive("Курс валюти має бути додатнім").default(1.0),
  description: z.string().trim().min(2, "Вкажіть опис витрати").max(2000),
});

export const allocationSchema = z.object({
  work_order_id: z.string().uuid(),
  budget_year: z.coerce.number().int().min(2020).max(2100),
  approved_amount: z.coerce.number().min(0, "Погоджена сума не може бути від'ємною"),
});
