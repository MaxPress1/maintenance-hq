import React from "react";
import { requirePagePermission } from "@/lib/auth/permissions";
import {
  getAnnualBudgets,
  getBudgetTransactions,
  getWorkOrderAllocations,
} from "@/features/finance/queries";
import { getWorkOrders } from "@/features/work-orders/queries";
import { calculateBudgetSummary } from "@/features/finance/schema";
import { BudgetSummaryCards } from "@/features/finance/budget-summary-cards";
import { TransactionsList } from "@/features/finance/transactions-list";
import { TransactionForm } from "@/features/finance/transaction-form";
import { AnnualBudgetForm } from "@/features/finance/annual-budget-form";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ year?: string }>;
}

export default async function BudgetPage({ searchParams }: Props) {
  const { supabase } = await requirePagePermission("finance.read");
  const { data: canManage } = await supabase.rpc("has_permission", {
    permission_code: "finance.manage",
  });

  const { year: yearParam } = await searchParams;
  const currentYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [budgets, transactions, allocations, workOrders] = await Promise.all([
    getAnnualBudgets(currentYear),
    getBudgetTransactions(),
    getWorkOrderAllocations(currentYear),
    getWorkOrders(),
  ]);

  const currentBudget = budgets.find((b) => b.year === currentYear) || null;
  const summary = calculateBudgetSummary(currentBudget, allocations, transactions);

  return (
    <div className="stack gap-6">
      <div className="page-title">
        <div>
          <span className="eyebrow">Фінансовий контроль</span>
          <h1 className="page-heading">Бюджет та облік витрат ({currentYear})</h1>
        </div>
      </div>

      <BudgetSummaryCards summary={summary} year={currentYear} />

      {canManage && (
        <div className="grid two-columns gap-6">
          <TransactionForm workOrders={workOrders} />
          <AnnualBudgetForm currentYear={currentYear} currentBudget={currentBudget} />
        </div>
      )}

      <TransactionsList transactions={transactions} canManage={Boolean(canManage)} />
    </div>
  );
}
