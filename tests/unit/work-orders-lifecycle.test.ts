import { describe, expect, it } from "vitest";
import {
  canTransitionWorkOrder,
  emergencyReportSchema,
  publicReportSchema,
  workOrderCreateSchema,
} from "../../src/features/work-orders/schema";

const validId = "20000000-0000-4000-8000-000000000001";

describe("Work orders validation", () => {
  it("validates valid work order creation", () => {
    const valid = {
      title: "  Заміна вентиля  ",
      description: "Опис поломки",
      asset_id: validId,
      work_type: "emergency",
      reported_urgency: "critical",
      priority: "high",
      responsible_id: validId,
      planned_start_date: "2026-11-01",
      planned_end_date: "2026-11-05",
      planned_cost: "1500.50",
    };
    const parsed = workOrderCreateSchema.parse(valid);
    expect(parsed.title).toBe("Заміна вентиля");
    expect(parsed.planned_cost).toBe(1500.5);
    expect(parsed.planned_end_date).toBe("2026-11-05");
  });

  it("rejects planned_end_date earlier than planned_start_date", () => {
    const invalidDates = {
      title: "Ремонт",
      asset_id: validId,
      planned_start_date: "2026-11-10",
      planned_end_date: "2026-11-05",
    };
    expect(workOrderCreateSchema.safeParse(invalidDates).success).toBe(false);
  });

  it("validates emergency and public report payloads", () => {
    expect(
      emergencyReportSchema.safeParse({
        asset_id: validId,
        description: "Прорвало трубу опалення",
        reported_urgency: "critical",
      }).success
    ).toBe(true);

    expect(
      publicReportSchema.safeParse({
        token: "tok_1234567890",
        description: "Не працює світло в коридорі",
        reported_urgency: "high",
      }).success
    ).toBe(true);

    expect(
      publicReportSchema.safeParse({
        token: "tok",
        description: "123",
      }).success
    ).toBe(false);
  });
});

describe("Work orders lifecycle state machine", () => {
  it("allows coordinator to triage new ticket to scheduled when responsible is present", () => {
    const res = canTransitionWorkOrder("new", "scheduled", ["coordinator"], false, true);
    expect(res.allowed).toBe(true);
  });

  it("prevents transition to active status without responsible", () => {
    const res = canTransitionWorkOrder("new", "in_progress", ["coordinator"], false, false);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("відповідальний");
  });

  it("allows assigned worker to start work and submit for review", () => {
    // scheduled -> in_progress
    expect(canTransitionWorkOrder("scheduled", "in_progress", ["worker"], true, true).allowed).toBe(true);

    // in_progress -> review
    expect(canTransitionWorkOrder("in_progress", "review", ["worker"], true, true).allowed).toBe(true);

    // in_progress -> waiting_materials
    expect(canTransitionWorkOrder("in_progress", "waiting_materials", ["worker"], true, true).allowed).toBe(true);
  });

  it("denies unassigned worker from changing status", () => {
    const res = canTransitionWorkOrder("scheduled", "in_progress", ["worker"], false, true);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("призначених");
  });

  it("prevents worker from confirming completion directly (requires review by coordinator)", () => {
    const res = canTransitionWorkOrder("in_progress", "completed", ["worker"], true, true);
    expect(res.allowed).toBe(false);
  });

  it("allows coordinator to complete work from review", () => {
    const res = canTransitionWorkOrder("review", "completed", ["coordinator"], false, true);
    expect(res.allowed).toBe(true);
  });

  it("rejects invalid status transitions in the graph", () => {
    // new cannot directly jump to completed
    const res = canTransitionWorkOrder("new", "completed", ["administrator"], false, true);
    expect(res.allowed).toBe(false);
  });
});
