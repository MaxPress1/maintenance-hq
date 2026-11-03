import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getWorkOrders } from "@/features/work-orders/queries";
import { getAssets } from "@/features/assets/queries";
import { getAnnualBudgets, getBudgetTransactions, getWorkOrderAllocations } from "@/features/finance/queries";
import { calculateBudgetSummary } from "@/features/finance/schema";
import { EmergencyReportModal } from "@/features/work-orders/emergency-modal";
import { StatusBadge, PriorityBadge } from "@/features/work-orders/status-badge";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/setup");
  }

  const { supabase } = await requirePagePermission("assets.read");
  const currentYear = new Date().getFullYear();
  const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const nowIso = new Date().toISOString();

  const [
    workOrders,
    assets,
    budgets,
    transactions,
    allocations,
    canReadFinance,
  ] = await Promise.all([
    getWorkOrders(),
    getAssets(),
    getAnnualBudgets(currentYear),
    getBudgetTransactions(),
    getWorkOrderAllocations(currentYear),
    supabase.rpc("has_permission", { permission_code: "finance.read" }),
  ]);

  const currentBudget = budgets.find((b) => b.year === currentYear) || null;
  const budgetSummary = calculateBudgetSummary(currentBudget, allocations, transactions);

  // Operational metrics
  const newOrders = workOrders.filter((wo) => wo.status === "new");
  const criticalOrders = workOrders.filter(
    (wo) =>
      wo.status !== "completed" &&
      wo.status !== "canceled" &&
      (wo.priority === "critical" || wo.work_type === "emergency" || wo.reported_urgency === "critical")
  );
  const inProgressOrders = workOrders.filter((wo) => wo.status === "in_progress");
  const overdueOrders = workOrders.filter(
    (wo) =>
      wo.status !== "completed" &&
      wo.status !== "canceled" &&
      ((wo.planned_end_date && wo.planned_end_date < nowIso.slice(0, 10)) ||
        (wo.deadline && wo.deadline < nowIso))
  );
  const thisMonthOrders = workOrders.filter(
    (wo) =>
      (wo.planned_start_date && wo.planned_start_date.startsWith(currentMonthStr)) ||
      (wo.planned_end_date && wo.planned_end_date.startsWith(currentMonthStr))
  );
  const pendingApprovalOrders = workOrders.filter(
    (wo) => wo.status === "pending_approval" || wo.status === "estimating"
  );
  const upcomingDeadlines = workOrders
    .filter((wo) => wo.status !== "completed" && wo.status !== "canceled" && wo.planned_end_date)
    .sort((a, b) => (a.planned_end_date || "").localeCompare(b.planned_end_date || ""))
    .slice(0, 5);

  return (
    <div className="stack gap-6">
      <div className="page-title">
        <div>
          <span className="eyebrow">Операційний огляд території</span>
          <h1 className="page-heading">Головна панель (Dashboard)</h1>
        </div>
        <div className="button-row items-center">
          <EmergencyReportModal assets={assets} />
          <Link href="/work-orders/new" className="button">
            + Створити заявку
          </Link>
          <Link href="/work-orders/new" className="button button-secondary">
            + Додати планову роботу
          </Link>
        </div>
      </div>

      {/* Primary Operational KPIs */}
      <section className="grid grid-cards" aria-label="Оперативні показники">
        <Link href="/work-orders?status=new" className="card metric-card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Нові заявки</span>
          <strong className="metric text-blue-700">{newOrders.length}</strong>
        </Link>

        <Link
          href="/work-orders?priority=critical"
          className={`card metric-card ${criticalOrders.length > 0 ? "critical" : ""}`}
        >
          <span className="text-xs uppercase font-semibold">Критичні / Аварії</span>
          <strong className="metric">{criticalOrders.length}</strong>
        </Link>

        <Link href="/work-orders?status=in_progress" className="card metric-card">
          <span className="text-xs text-gray-500 uppercase font-semibold">У процесі</span>
          <strong className="metric text-indigo-700">{inProgressOrders.length}</strong>
        </Link>

        <Link
          href="/work-orders"
          className={`card metric-card ${overdueOrders.length > 0 ? "bg-amber-50 border-amber-200" : ""}`}
        >
          <span className="text-xs text-gray-500 uppercase font-semibold">Прострочені роботи</span>
          <strong className={`metric ${overdueOrders.length > 0 ? "text-amber-800" : "text-emerald-700"}`}>
            {overdueOrders.length}
          </strong>
        </Link>

        <Link href="/planning?view=calendar" className="card metric-card">
          <span className="text-xs text-gray-500 uppercase font-semibold">План на цей місяць</span>
          <strong className="metric text-slate-800">{thisMonthOrders.length}</strong>
        </Link>

        <Link href="/assets" className="card metric-card">
          <span className="text-xs text-gray-500 uppercase font-semibold">Об’єкти на обліку</span>
          <strong className="metric text-emerald-800">{assets.length}</strong>
        </Link>
      </section>

      {/* Financial KPIs (if permitted) */}
      {canReadFinance?.data && (
        <section className="card stack bg-slate-50/70 border-slate-300">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-base font-bold text-slate-800 m-0">Фінансовий статус ({currentYear})</h2>
            <Link href="/budget" className="text-xs text-emerald-800 hover:underline font-semibold">
              Детальніше у розділі «Бюджет» →
            </Link>
          </div>

          <div className="grid grid-cards">
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold block">Річний бюджет</span>
              <strong className="text-lg font-bold text-slate-800">
                {budgetSummary.plannedAmount.toFixed(2)} ₴
              </strong>
            </div>

            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold block">Погоджено під роботи</span>
              <strong className="text-lg font-bold text-indigo-700">
                {budgetSummary.allocatedAmount.toFixed(2)} ₴
              </strong>
            </div>

            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold block">Фактичні витрати</span>
              <strong className={`text-lg font-bold ${budgetSummary.hasOverrun ? "text-rose-700" : "text-emerald-700"}`}>
                {budgetSummary.actualSpent.toFixed(2)} ₴
              </strong>
            </div>

            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold block">Залишок доступного бюджету</span>
              <strong className="text-lg font-bold text-emerald-800">
                {budgetSummary.availableForAllocation.toFixed(2)} ₴
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* Critical issues & deadlines */}
      <div className="grid two-columns gap-6">
        <section className="card stack">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-base font-bold text-rose-800 m-0">🚨 Критичні проблеми та аварії</h2>
            <Link href="/work-orders?priority=critical" className="text-xs text-slate-500 hover:underline">
              Всі аварії ({criticalOrders.length})
            </Link>
          </div>

          {criticalOrders.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-3">Немає активних аварій або критичних заявок.</p>
          ) : (
            <ul className="record-list">
              {criticalOrders.slice(0, 5).map((wo) => (
                <li key={wo.id} className="flex justify-between items-center">
                  <div>
                    <Link href={`/work-orders/${wo.id}`} className="font-semibold text-rose-900 hover:underline block text-sm">
                      #{wo.number} {wo.title}
                    </Link>
                    <span className="text-xs text-gray-500">{wo.asset?.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PriorityBadge priority={wo.priority} />
                    <StatusBadge status={wo.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card stack">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-base font-bold text-slate-800 m-0">⏳ Найближчі дедлайни робіт</h2>
            <Link href="/planning?view=calendar" className="text-xs text-slate-500 hover:underline">
              Календарний графік →
            </Link>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-3">Немає призначених дедлайнів на найближчий час.</p>
          ) : (
            <ul className="record-list">
              {upcomingDeadlines.map((wo) => (
                <li key={wo.id} className="flex justify-between items-center">
                  <div>
                    <Link href={`/work-orders/${wo.id}`} className="font-medium text-emerald-800 hover:underline block text-sm">
                      #{wo.number} {wo.title}
                    </Link>
                    <span className="text-xs text-gray-500">
                      {wo.responsible?.display_name || "Не призначено"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-800 block">
                      {wo.planned_end_date ? formatDate(wo.planned_end_date) : "—"}
                    </span>
                    <StatusBadge status={wo.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pending approval & recently created */}
      <div className="grid two-columns gap-6">
        <section className="card stack">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-base font-bold text-slate-800 m-0">📋 Очікують оцінки та погодження</h2>
            <span className="text-xs text-slate-500">({pendingApprovalOrders.length})</span>
          </div>

          {pendingApprovalOrders.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-3">Немає робіт, що очікують погодження.</p>
          ) : (
            <ul className="record-list">
              {pendingApprovalOrders.slice(0, 5).map((wo) => (
                <li key={wo.id} className="flex justify-between items-center">
                  <div>
                    <Link href={`/work-orders/${wo.id}`} className="font-medium text-emerald-800 hover:underline block text-sm">
                      #{wo.number} {wo.title}
                    </Link>
                    <span className="text-xs text-gray-500">{wo.asset?.name}</span>
                  </div>
                  <StatusBadge status={wo.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card stack">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-base font-bold text-slate-800 m-0">🕒 Нещодавно створені заявки</h2>
            <Link href="/work-orders" className="text-xs text-slate-500 hover:underline">
              Всі заявки →
            </Link>
          </div>

          <ul className="record-list">
            {workOrders.slice(0, 5).map((wo) => (
              <li key={wo.id} className="flex justify-between items-center">
                <div>
                  <Link href={`/work-orders/${wo.id}`} className="font-medium text-emerald-800 hover:underline block text-sm">
                    #{wo.number} {wo.title}
                  </Link>
                  <span className="text-xs text-gray-500">
                    {formatDate(wo.created_at)} · {wo.source === "public" ? "Публічна" : "Внутрішня"}
                  </span>
                </div>
                <StatusBadge status={wo.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
