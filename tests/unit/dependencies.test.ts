import { describe, expect, it } from "vitest";
import {
  dependencySchema,
  rescheduleSchema,
  willCauseCycle,
} from "../../src/features/planning/schema";

const idA = "10000000-0000-4000-8000-000000000001";
const idB = "10000000-0000-4000-8000-000000000002";
const idC = "10000000-0000-4000-8000-000000000003";
const idD = "10000000-0000-4000-8000-000000000004";

describe("Planning and dependencies", () => {
  it("rejects self dependency", () => {
    expect(
      dependencySchema.safeParse({
        work_order_id: idA,
        depends_on_work_order_id: idA,
      }).success
    ).toBe(false);
  });

  it("validates reschedule with mandatory reason", () => {
    expect(
      rescheduleSchema.safeParse({
        work_order_id: idA,
        new_start_date: "2026-11-01",
        new_end_date: "2026-11-05",
        reason: "Очікуємо поставку запчастин",
      }).success
    ).toBe(true);

    expect(
      rescheduleSchema.safeParse({
        work_order_id: idA,
        new_start_date: "2026-11-10",
        new_end_date: "2026-11-05",
        reason: "Помилкові дати",
      }).success
    ).toBe(false);

    expect(
      rescheduleSchema.safeParse({
        work_order_id: idA,
        new_start_date: "2026-11-01",
        reason: " ",
      }).success
    ).toBe(false);
  });

  it("detects direct cycle A -> B and B -> A", () => {
    const existing = [{ work_order_id: idA, depends_on_work_order_id: idB, created_at: "" }];
    // Attempt to add B depends on A
    expect(willCauseCycle(existing, idB, idA)).toBe(true);
  });

  it("detects transitive cycle A -> B -> C and C -> A", () => {
    const existing = [
      { work_order_id: idA, depends_on_work_order_id: idB, created_at: "" },
      { work_order_id: idB, depends_on_work_order_id: idC, created_at: "" },
    ];
    // Attempt to add C depends on A
    expect(willCauseCycle(existing, idC, idA)).toBe(true);
  });

  it("allows valid non-cyclic dependencies A -> B -> C and D -> C", () => {
    const existing = [
      { work_order_id: idA, depends_on_work_order_id: idB, created_at: "" },
      { work_order_id: idB, depends_on_work_order_id: idC, created_at: "" },
    ];
    // Attempt to add D depends on C
    expect(willCauseCycle(existing, idD, idC)).toBe(false);
    // Attempt to add A depends on D
    expect(willCauseCycle(existing, idA, idD)).toBe(false);
  });
});
