/**
 * Generates safe CSV content with UTF-8 BOM and formula injection protection.
 */
export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // Protection against spreadsheet formula injection (CSV Injection / CWE-1236)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes by doubling them
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map((h) => sanitizeCsvField(h)).join(",");
  const rowLines = rows.map((row) => row.map((cell) => sanitizeCsvField(cell)).join(","));

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility with Ukrainian Cyrillic
  return `\uFEFF${headerLine}\n${rowLines.join("\n")}`;
}
