import { describe, expect, it } from "vitest";
import { assetSchema, inspectionSchema, parentOptions, siteSchema, type Asset } from "../../src/features/assets/schema";
import { dateInput, endOfKyivDay, formatDate } from "../../src/lib/dates";

const id = "20000000-0000-4000-8000-000000000001";
const valid = { name: " Насос ", description: "", site_id: id, parent_id: "", type: "equipment", condition: "good", location_description: "", responsible_id: "", next_inspection_date: "2026-11-01" };

describe("Валідація об’єктів", () => {
  it("прибирає пробіли й нормалізує необов’язкові зв’язки", () => {
    expect(assetSchema.parse(valid)).toMatchObject({ name: "Насос", parent_id: null, responsible_id: null });
  });
  it.each([
    { name: "   " }, { name: "x".repeat(201) }, { site_id: "bad" }, { type: "invented" },
    { condition: "invented" }, { responsible_id: "bad" }, { next_inspection_date: "2026-02-30" },
    { description: "x".repeat(5001) },
  ])("відхиляє неправильні дані %j", (invalid) => {
    expect(assetSchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
  });
  it("вимагає опис огляду", () => {
    expect(inspectionSchema.safeParse({ asset_id: id, condition: "good", next_inspection_date: "", notes: " " }).success).toBe(false);
    expect(siteSchema.safeParse({ name: "Територія", description: "" }).success).toBe(true);
  });
  it("виключає нащадків, сам об’єкт, архів і чужу територію з батьків", () => {
    const assets = [
      { id: "root", site_id: "a", parent_id: null }, { id: "child", site_id: "a", parent_id: "root" },
      { id: "leaf", site_id: "a", parent_id: "child" }, { id: "allowed", site_id: "a", parent_id: null },
      { id: "archived", site_id: "a", parent_id: null, archived_at: "2026-01-01" },
      { id: "other", site_id: "b", parent_id: null },
    ] as Asset[];
    expect(parentOptions(assets, "a", "root").map((asset) => asset.id)).toEqual(["allowed"]);
  });
  it("завершує обхід навіть для пошкодженого циклічного дерева", () => {
    const assets = [{ id: "a", parent_id: "b", site_id: "s" }, { id: "b", parent_id: "a", site_id: "s" }] as Asset[];
    expect(parentOptions(assets, "s", "a")).toEqual([]);
  });
});

describe("Дати Europe/Kyiv", () => {
  it.each([
    ["2026-01-20", "2026-01-20T21:59:59.000Z"],
    ["2026-07-20", "2026-07-20T20:59:59.000Z"],
    ["2026-03-29", "2026-03-29T20:59:59.000Z"],
    ["2026-10-25", "2026-10-25T21:59:59.000Z"],
  ])("зберігає кінець локального дня %s", (day, expected) => {
    expect(endOfKyivDay(day)).toBe(expected);
    expect(dateInput(expected)).toBe(day);
  });
  it("обробляє порожні дати й межу доби", () => {
    expect(endOfKyivDay("")).toBeNull();
    expect(dateInput(null)).toBe("");
    expect(formatDate("2026-01-01T22:30:00Z")).toBe("02.01.2026");
  });
});