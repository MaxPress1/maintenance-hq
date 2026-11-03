export const REPORT_TYPES = [
  "completed_period",
  "uncompleted_overdue",
  "emergency_works",
  "expenses_by_asset",
  "expenses_by_month",
  "plan_vs_fact",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  completed_period: "1. Виконані роботи за період",
  uncompleted_overdue: "2. Невиконані та прострочені роботи",
  emergency_works: "3. Аварійні роботи",
  expenses_by_asset: "4. Витрати за об’єктами",
  expenses_by_month: "5. Витрати за місяцями",
  plan_vs_fact: "6. Планові проти фактичних витрат",
};

export interface ReportFilter {
  reportType: ReportType;
  startDate?: string;
  endDate?: string;
  assetId?: string;
  year?: number;
}
