import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertAmount } from "@/lib/currency";

const USER_ID = "demo-user";
async function getUser() {
  return prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, name: "Demo User", email: "demo@example.com" },
  });
}

interface MappedRow {
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string;
  currency?: string;
  accountId: string;
  revenueStreamId?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const { rows, accountId } = body as {
      rows: MappedRow[];
      accountId: string;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided" },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const batchId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const created: Array<{ id: string; description: string; isDuplicate: boolean }> = [];
    const duplicates: Array<{ description: string; date: string; amount: number }> = [];
    let balanceChange = 0;

    for (const row of rows) {
      const txDate = new Date(row.date);
      if (isNaN(txDate.getTime())) continue;

      const txCurrency = row.currency || account.currency;
      const amount = Math.abs(row.amount);

      // Duplicate detection: same account, date, amount, similar description
      const existingTx = await prisma.transaction.findFirst({
        where: {
          userId: user.id,
          accountId: row.accountId || accountId,
          originalAmount: amount,
          date: {
            gte: new Date(txDate.getTime() - 86400000), // 1 day tolerance
            lte: new Date(txDate.getTime() + 86400000),
          },
          description: { contains: row.description.substring(0, 20) },
        },
      });

      if (existingTx) {
        duplicates.push({
          description: row.description,
          date: row.date,
          amount,
        });
        continue;
      }

      // Convert to primary currency
      const { converted, rate } = await convertAmount(
        amount,
        txCurrency,
        user.primaryCurrency,
        txDate.toISOString().split("T")[0]
      );

      const transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          accountId: row.accountId || accountId,
          type: row.type || "expense",
          description: row.description,
          originalAmount: amount,
          originalCurrency: txCurrency,
          convertedAmount: converted,
          conversionRate: rate,
          category: row.category || null,
          date: txDate,
          revenueStreamId: row.revenueStreamId || null,
          importBatchId: batchId,
          notes: row.notes || null,
        },
      });

      const change = row.type === "income" ? amount : -amount;
      balanceChange += change;

      created.push({
        id: transaction.id,
        description: transaction.description,
        isDuplicate: false,
      });
    }

    // Update account balance
    if (balanceChange !== 0) {
      await prisma.account.update({
        where: { id: accountId },
        data: { balance: { increment: balanceChange } },
      });
    }

    return NextResponse.json({
      batchId,
      imported: created.length,
      duplicatesSkipped: duplicates.length,
      duplicates,
      created,
      balanceChange,
    });
  } catch (error) {
    console.error("POST /api/import/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm import" },
      { status: 500 }
    );
  }
}
