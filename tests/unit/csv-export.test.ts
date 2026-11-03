import { describe, expect, it } from "vitest";
import { generateCsv, sanitizeCsvField } from "../../src/lib/export/csv";

describe("Safe CSV generation", () => {
  it("prepends single quote to formula trigger characters to prevent CSV injection", () => {
    expect(sanitizeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvField("+123456")).toBe("'+123456");
    expect(sanitizeCsvField("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(sanitizeCsvField("@echo off")).toBe("'@echo off");
  });

  it("escapes quotes and handles commas properly", () => {
    expect(sanitizeCsvField('Труба 1"')).toBe('"Труба 1"""');
    expect(sanitizeCsvField("Київ, вул. Шевченка")).toBe('"Київ, вул. Шевченка"');
  });

  it("includes UTF-8 BOM prefix for Excel compatibility with Ukrainian text", () => {
    const headers = ["№", "Назва", "Сума"];
    const rows = [
      [1, "Ремонт даху", 15000],
      [2, "Заміна насоса", 8200.5],
    ];

    const csv = generateCsv(headers, rows);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Ремонт даху");
    expect(csv).toContain("15000");
  });
});
