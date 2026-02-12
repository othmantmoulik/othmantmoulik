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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    const { id } = await params;

    const debt = await prisma.debt.findFirst({
      where: { id, userId: user.id },
      include: {
        payments: {
          orderBy: { date: "desc" },
          include: {
            transaction: {
              select: { id: true, description: true, originalAmount: true },
            },
          },
        },
      },
    });

    if (!debt) {
      return NextResponse.json(
        { error: "Debt not found" },
        { status: 404 }
      );
    }

    const totalPaid = debt.payments.reduce(
      (sum: number, p: { amount: number }) => sum + p.amount,
      0
    );

    return NextResponse.json({ ...debt, totalPaid });
  } catch (error) {
    console.error("GET /api/debts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debt" },
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

    const existing = await prisma.debt.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Debt not found" },
        { status: 404 }
      );
    }

    const debt = await prisma.debt.update({
      where: { id },
      data: {
        creditorName: body.creditorName ?? existing.creditorName,
        description: body.description !== undefined ? body.description : existing.description,
        originalAmount: body.originalAmount ?? existing.originalAmount,
        remainingBalance: body.remainingBalance ?? existing.remainingBalance,
        currency: body.currency ?? existing.currency,
        interestRate: body.interestRate ?? existing.interestRate,
        interestType: body.interestType ?? existing.interestType,
        minimumPayment: body.minimumPayment !== undefined ? body.minimumPayment : existing.minimumPayment,
        dueDay: body.dueDay !== undefined ? body.dueDay : existing.dueDay,
        payoffDeadline: body.payoffDeadline !== undefined
          ? body.payoffDeadline ? new Date(body.payoffDeadline) : null
          : existing.payoffDeadline,
        priority: body.priority ?? existing.priority,
        status: body.status ?? existing.status,
        isIslamic: body.isIslamic ?? existing.isIslamic,
        autoPay: body.autoPay ?? existing.autoPay,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    });

    return NextResponse.json(debt);
  } catch (error) {
    console.error("PUT /api/debts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update debt" },
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

    const existing = await prisma.debt.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Debt not found" },
        { status: 404 }
      );
    }

    // Delete payments first, then debt
    await prisma.debtPayment.deleteMany({ where: { debtId: id } });
    await prisma.debt.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/debts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete debt" },
      { status: 500 }
    );
  }
}
