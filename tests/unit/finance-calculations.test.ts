import { describe, expect, it } from "vitest";
import {
  annualBudgetSchema,
  calculateBudgetSummary,
  calculateUahEquivalent,
} from "../../src/features/finance/schema";

describe("Finance calculations and currency conversions", () => {
  it("accurately converts foreign currency to UAH with decimal rounding", () => {
    // 100 USD at 41.255 UAH
    expect(calculateUahEquivalent(100, 41.255)).toBe(4125.5);

    // 12.34 EUR at 44.5678 UAH -> 549.97
    expect(calculateUahEquivalent(12.34, 44.5678)).toBe(549.97);

    // Negative amounts (storno or refunds)
    expect(calculateUahEquivalent(-50, 40.0)).toBe(-2000.0);
  });

  it("calculates budget metrics, free budget, and reserve", () => {
    const budget = { planned_amount: 100000, reserve_amount: 10000 };
    const allocations = [{ approved_amount: 30000 }, { approved_amount: 25000 }];
    const transactions = [
      { amount_uah: 15000, status: "posted" },
      { amount_uah: 12000, status: "posted" },
      { amount_uah: 5000, status: "draft" }, // draft should not count towards actual spent
    ];

    const summary = calculateBudgetSummary(budget, allocations, transactions);
    expect(summary.plannedAmount).toBe(100000);
    expect(summary.reserveAmount).toBe(10000);
    expect(summary.allocatedAmount).toBe(55000);
    expect(summary.actualSpent).toBe(27000);
    expect(summary.freeBudget).toBe(45000); // 100000 - 55000
    expect(summary.availableForAllocation).toBe(35000); // 45000 - 10000 (reserve)
    expect(summary.hasOverrun).toBe(false);
  });

  it("identifies budget overrun when actual spent exceeds allocated", () => {
    const budget = { planned_amount: 50000, reserve_amount: 0 };
    const allocations = [{ approved_amount: 20000 }];
    const transactions = [
      { amount_uah: 25000, status: "posted" }, // Spent 25k against 20k approved
    ];

    const summary = calculateBudgetSummary(budget, allocations, transactions);
    expect(summary.hasOverrun).toBe(true);
    expect(summary.overrunAmount).toBe(5000);
  });

  it("properly handles storno transactions reducing actual spent", () => {
    const budget = { planned_amount: 50000, reserve_amount: 0 };
    const allocations = [{ approved_amount: 20000 }];
    const transactions = [
      { amount_uah: 10000, status: "posted" },
      { amount_uah: -10000, status: "posted" }, // Storno
      { amount_uah: 8000, status: "posted" }, // Corrected transaction
    ];

    const summary = calculateBudgetSummary(budget, allocations, transactions);
    expect(summary.actualSpent).toBe(8000);
  });

  it("validates annual budget constraints", () => {
    expect(
      annualBudgetSchema.safeParse({
        year: 2026,
        planned_amount: 500000,
        reserve_amount: 50000,
      }).success
    ).toBe(true);

    // Reserve cannot exceed planned amount
    expect(
      annualBudgetSchema.safeParse({
        year: 2026,
        planned_amount: 100000,
        reserve_amount: 150000,
      }).success
    ).toBe(false);
  });
});
