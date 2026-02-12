// File import parsers for CSV, Excel, and PDF

import * as XLSX from "xlsx";

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  headers: string[];
  sheetNames?: string[];
  selectedSheet?: string;
  fileType: "csv" | "xlsx" | "xls" | "pdf";
  warnings: string[];
}

export interface ColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  balance?: string;
  category?: string;
  currency?: string;
}

export interface MappedTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  currency?: string;
  balance?: number;
  isDuplicate?: boolean;
  originalRow: ParsedRow;
}

// CSV Parser
export function parseCSV(content: string): ParseResult {
  const warnings: string[] = [];
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return { rows: [], headers: [], fileType: "csv", warnings: ["Empty file"] };
  }

  // Detect delimiter
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const delimiter = tabCount > commaCount && tabCount > semicolonCount ? "\t" : semicolonCount > commaCount ? ";" : ",";

  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (values.length === 0 || values.every((v) => !v.trim())) continue;

    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() ?? null;
    });
    rows.push(row);
  }

  return { rows, headers, fileType: "csv", warnings };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Excel Parser
export function parseExcel(buffer: ArrayBuffer, sheetName?: string): ParseResult {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames;

  const selectedSheet = sheetName || sheetNames[0];
  const sheet = workbook.Sheets[selectedSheet];

  if (!sheet) {
    return { rows: [], headers: [], sheetNames, selectedSheet, fileType: "xlsx", warnings: ["Sheet not found"] };
  }

  // Handle merged cells
  if (sheet["!merges"]) {
    for (const merge of sheet["!merges"]) {
      const topLeftRef = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      const topLeftValue = sheet[topLeftRef]?.v;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!sheet[ref]) {
            sheet[ref] = { t: "s", v: topLeftValue };
          }
        }
      }
    }
    warnings.push("Merged cells were detected and flattened");
  }

  const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null });

  if (jsonData.length === 0) {
    return { rows: [], headers: [], sheetNames, selectedSheet, fileType: "xlsx", warnings: ["Empty sheet"] };
  }

  const headers = Object.keys(jsonData[0]);
  const rows = jsonData.filter((row) => {
    return Object.values(row).some((v) => v !== null && v !== "");
  });

  return { rows, headers, sheetNames, selectedSheet, fileType: "xlsx", warnings };
}

// PDF Text Parser (basic table detection)
export function parsePDFText(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.split("\n").filter((l) => l.trim());

  if (lines.length === 0) {
    return { rows: [], headers: [], fileType: "pdf", warnings: ["No text extracted from PDF"] };
  }

  // Try to detect table structure
  // Look for lines with consistent delimiters (multiple spaces, tabs)
  const tableLines: string[][] = [];

  for (const line of lines) {
    // Split by 2+ spaces (common in PDF tables)
    const cells = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c);
    if (cells.length >= 3) {
      tableLines.push(cells);
    }
  }

  if (tableLines.length < 2) {
    // Try date-based detection: look for lines starting with a date pattern
    const datePattern = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
    const transactionLines: string[][] = [];

    for (const line of lines) {
      if (datePattern.test(line.trim())) {
        const parts = line.trim().split(/\s{2,}/).map((c) => c.trim()).filter((c) => c);
        if (parts.length >= 2) {
          transactionLines.push(parts);
        }
      }
    }

    if (transactionLines.length > 0) {
      const maxCols = Math.max(...transactionLines.map((l) => l.length));
      const headers = ["Date", "Description"];
      for (let i = 2; i < maxCols; i++) {
        headers.push(`Column ${i + 1}`);
      }

      const rows: ParsedRow[] = transactionLines.map((cells) => {
        const row: ParsedRow = {};
        headers.forEach((header, idx) => {
          row[header] = cells[idx] ?? null;
        });
        return row;
      });

      warnings.push("PDF table structure was auto-detected. Please review and adjust column mappings.");
      return { rows, headers, fileType: "pdf", warnings };
    }

    warnings.push("Could not detect a table structure in this PDF. The text content is shown for manual review.");
    const rows = lines.map((line, i) => ({ "Line": i + 1, "Content": line.trim() }));
    return { rows, headers: ["Line", "Content"], fileType: "pdf", warnings };
  }

  // Use first table line as headers (or generate generic headers)
  const firstRow = tableLines[0];
  const hasTextHeader = firstRow.some((cell) => /^[a-zA-Z]/.test(cell));

  let headers: string[];
  let dataStart: number;

  if (hasTextHeader) {
    headers = firstRow;
    dataStart = 1;
  } else {
    headers = firstRow.map((_, i) => `Column ${i + 1}`);
    dataStart = 0;
  }

  const rows: ParsedRow[] = [];
  for (let i = dataStart; i < tableLines.length; i++) {
    const cells = tableLines[i];
    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? null;
    });
    rows.push(row);
  }

  return { rows, headers, fileType: "pdf", warnings };
}

// Auto-detect column mapping
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = headers.map((h) => h.toLowerCase().trim());

  for (let i = 0; i < lower.length; i++) {
    const h = lower[i];
    if (!mapping.date && (h.includes("date") || h.includes("time") || h === "posted" || h === "trans date")) {
      mapping.date = headers[i];
    }
    if (!mapping.description && (h.includes("description") || h.includes("desc") || h.includes("memo") || h.includes("narrative") || h.includes("details") || h.includes("payee"))) {
      mapping.description = headers[i];
    }
    if (!mapping.amount && (h === "amount" || h.includes("total") || (h.includes("amount") && !h.includes("debit") && !h.includes("credit")))) {
      mapping.amount = headers[i];
    }
    if (!mapping.debit && (h.includes("debit") || h === "withdrawal" || h === "out")) {
      mapping.debit = headers[i];
    }
    if (!mapping.credit && (h.includes("credit") || h === "deposit" || h === "in")) {
      mapping.credit = headers[i];
    }
    if (!mapping.balance && (h.includes("balance") || h.includes("running"))) {
      mapping.balance = headers[i];
    }
    if (!mapping.category && (h.includes("category") || h.includes("type") || h.includes("class"))) {
      mapping.category = headers[i];
    }
    if (!mapping.currency && (h.includes("currency") || h === "ccy" || h === "curr")) {
      mapping.currency = headers[i];
    }
  }

  return mapping;
}

// Apply column mapping to parsed rows
export function applyMapping(rows: ParsedRow[], mapping: ColumnMapping): MappedTransaction[] {
  const transactions: MappedTransaction[] = [];

  for (const row of rows) {
    let dateStr = mapping.date ? String(row[mapping.date] ?? "") : "";
    const description = mapping.description ? String(row[mapping.description] ?? "") : "";

    let amount = 0;
    if (mapping.amount) {
      amount = parseAmount(String(row[mapping.amount] ?? "0"));
    } else if (mapping.debit || mapping.credit) {
      const debit = mapping.debit ? parseAmount(String(row[mapping.debit] ?? "0")) : 0;
      const credit = mapping.credit ? parseAmount(String(row[mapping.credit] ?? "0")) : 0;
      amount = credit - debit;
    }

    const category = mapping.category ? String(row[mapping.category] ?? "") : undefined;
    const currency = mapping.currency ? String(row[mapping.currency] ?? "") : undefined;
    const balance = mapping.balance ? parseAmount(String(row[mapping.balance] ?? "0")) : undefined;

    if (!dateStr && !description && amount === 0) continue;

    // Handle Date objects from Excel
    const dateVal = row[mapping.date || ""];
    if (dateVal && typeof dateVal === "object" && (dateVal as unknown as Date).toISOString) {
      dateStr = (dateVal as unknown as Date).toISOString().split("T")[0];
    }

    transactions.push({
      date: dateStr,
      description,
      amount,
      category: category || undefined,
      currency: currency || undefined,
      balance: balance || undefined,
      originalRow: row,
    });
  }

  return transactions;
}

function parseAmount(str: string): number {
  if (!str) return 0;
  // Remove currency symbols and thousand separators
  const cleaned = str.replace(/[^0-9.\-,]/g, "");
  // Handle European format (1.234,56 -> 1234.56)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // European: 1.234,56
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    }
    // US: 1,234.56
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    // Could be 1,234 or 1,23 — if digits after comma are 3, treat as thousand sep
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length === 3) {
      return parseFloat(cleaned.replace(",", ""));
    }
    return parseFloat(cleaned.replace(",", "."));
  }
  return parseFloat(cleaned) || 0;
}

// Duplicate detection
export function detectDuplicates(
  newTransactions: MappedTransaction[],
  existingTransactions: Array<{ date: string; amount: number; description: string }>
): MappedTransaction[] {
  return newTransactions.map((tx) => {
    const isDuplicate = existingTransactions.some((existing) => {
      const dateDiff = Math.abs(
        new Date(tx.date).getTime() - new Date(existing.date).getTime()
      );
      const dayInMs = 86400000;
      return (
        dateDiff <= dayInMs &&
        Math.abs(tx.amount - existing.amount) < 0.01 &&
        tx.description.toLowerCase().includes(existing.description.toLowerCase().substring(0, 10))
      );
    });
    return { ...tx, isDuplicate };
  });
}
