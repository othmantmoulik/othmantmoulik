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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    const { id } = await params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      include: {
        account: { select: { name: true, currency: true } },
        revenueStream: { select: { name: true, type: true } },
        linkedPayouts: true,
        linkedBillPayments: true,
        linkedDebtPayments: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("GET /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // If amount or currency changed, recalculate conversion
    let convertedAmount = existing.convertedAmount;
    let conversionRate = existing.conversionRate;

    const newAmount = body.originalAmount ?? existing.originalAmount;
    const newCurrency = body.originalCurrency ?? existing.originalCurrency;

    if (
      newAmount !== existing.originalAmount ||
      newCurrency !== existing.originalCurrency
    ) {
      const dateStr = (body.date ? new Date(body.date) : existing.date)
        .toISOString()
        .split("T")[0];
      const result = await convertAmount(
        newAmount,
        newCurrency,
        user.primaryCurrency,
        dateStr
      );
      convertedAmount = result.converted;
      conversionRate = result.rate;

      // Adjust account balance
      const oldBalanceEffect =
        existing.type === "income"
          ? existing.originalAmount
          : -existing.originalAmount;
      const newType = body.type ?? existing.type;
      const newBalanceEffect =
        newType === "income" ? newAmount : -newAmount;
      const balanceDiff = newBalanceEffect - oldBalanceEffect;

      if (balanceDiff !== 0) {
        await prisma.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: balanceDiff } },
        });
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        type: body.type ?? existing.type,
        description: body.description ?? existing.description,
        originalAmount: newAmount,
        originalCurrency: newCurrency,
        convertedAmount,
        conversionRate,
        category: body.category !== undefined ? body.category : existing.category,
        date: body.date ? new Date(body.date) : existing.date,
        revenueStreamId:
          body.revenueStreamId !== undefined
            ? body.revenueStreamId
            : existing.revenueStreamId,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        isReconciled: body.isReconciled ?? existing.isReconciled,
      },
      include: {
        account: { select: { name: true, currency: true } },
        revenueStream: { select: { name: true, type: true } },
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("PUT /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Reverse balance change
    const balanceChange =
      existing.type === "income"
        ? -existing.originalAmount
        : existing.originalAmount;
    await prisma.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: balanceChange } },
    });

    await prisma.transaction.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
