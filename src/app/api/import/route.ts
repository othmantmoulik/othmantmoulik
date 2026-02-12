import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const USER_ID = "demo-user";
async function getUser() {
  return prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, name: "Demo User", email: "demo@example.com" },
  });
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string;
  currency?: string;
  raw: Record<string, string>;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields with commas
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = values[idx] || "";
    });

    // Auto-detect columns
    const dateCol = headers.find((h) =>
      /date|time|posted|trans/i.test(h)
    );
    const descCol = headers.find((h) =>
      /desc|narr|detail|memo|payee|merchant/i.test(h)
    );
    const amountCol = headers.find((h) =>
      /amount|sum|value|total/i.test(h)
    );
    const debitCol = headers.find((h) => /debit|withdrawal|out/i.test(h));
    const creditCol = headers.find((h) => /credit|deposit|in/i.test(h));
    const categoryCol = headers.find((h) => /category|cat|type/i.test(h));

    let amount = 0;
    let type = "expense";

    if (amountCol && raw[amountCol]) {
      const parsed = parseFloat(raw[amountCol].replace(/[,$]/g, ""));
      if (!isNaN(parsed)) {
        amount = Math.abs(parsed);
        type = parsed >= 0 ? "income" : "expense";
      }
    } else if (debitCol || creditCol) {
      const debit = debitCol
        ? parseFloat((raw[debitCol] || "0").replace(/[,$]/g, ""))
        : 0;
      const credit = creditCol
        ? parseFloat((raw[creditCol] || "0").replace(/[,$]/g, ""))
        : 0;
      if (!isNaN(credit) && credit > 0) {
        amount = credit;
        type = "income";
      } else if (!isNaN(debit) && debit > 0) {
        amount = debit;
        type = "expense";
      }
    }

    rows.push({
      date: dateCol ? raw[dateCol] : "",
      description: descCol ? raw[descCol] : values.slice(1).join(" ").trim(),
      amount,
      type,
      category: categoryCol ? raw[categoryCol] : undefined,
      raw,
    });
  }

  return rows;
}

async function parseExcel(buffer: Buffer): Promise<ParsedRow[]> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_csv(sheet);
    return parseCSV(data);
  } catch (error) {
    console.error("Excel parsing error:", error);
    throw new Error("Failed to parse Excel file. Ensure xlsx package is installed.");
  }
}

async function parsePDF(buffer: Buffer): Promise<ParsedRow[]> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const text = result.text;

    // Simple line-based parsing for bank statements
    const lines = text.split("\n").filter((l: string) => l.trim());
    const rows: ParsedRow[] = [];

    // Try to find transaction lines (date pattern followed by description and amount)
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
    const amountPattern = /[\$]?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;

    for (const line of lines) {
      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;

      const amounts = line.match(amountPattern);
      if (!amounts || amounts.length === 0) continue;

      const lastAmount = amounts[amounts.length - 1];
      const amount = parseFloat(lastAmount.replace(/[$,]/g, ""));
      if (isNaN(amount) || amount === 0) continue;

      // Extract description (text between date and amount)
      const dateEnd = line.indexOf(dateMatch[0]) + dateMatch[0].length;
      const amountStart = line.lastIndexOf(lastAmount);
      const description = line.substring(dateEnd, amountStart).trim();

      if (description.length < 2) continue;

      rows.push({
        date: dateMatch[1],
        description,
        amount: Math.abs(amount),
        type: line.toLowerCase().includes("cr") || amount > 0 ? "income" : "expense",
        raw: { line },
      });
    }

    await parser.destroy();

    return rows;
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error("Failed to parse PDF file. Ensure pdf-parse package is installed.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await getUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let rows: ParsedRow[] = [];
    let fileType: string;

    if (fileName.endsWith(".csv")) {
      fileType = "csv";
      const text = buffer.toString("utf-8");
      rows = parseCSV(text);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      fileType = fileName.endsWith(".xlsx") ? "xlsx" : "xls";
      rows = await parseExcel(buffer);
    } else if (fileName.endsWith(".pdf")) {
      fileType = "pdf";
      rows = await parsePDF(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use CSV, XLSX, XLS, or PDF." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      fileType,
      fileName: file.name,
      totalRows: rows.length,
      rows,
      preview: rows.slice(0, 10),
    });
  } catch (error) {
    console.error("POST /api/import error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to import file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
