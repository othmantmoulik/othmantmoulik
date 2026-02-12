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

export async function GET() {
  try {
    const user = await getUser();

    const debts = await prisma.debt.findMany({
      where: { userId: user.id },
      include: {
        payments: {
          orderBy: { date: "desc" },
          select: { amount: true, date: true },
        },
      },
      orderBy: [{ priority: "asc" }, { payoffDeadline: "asc" }],
    });

    const enriched = debts.map((debt: typeof debts[number]) => {
      const totalPaid = debt.payments.reduce(
        (sum: number, p: { amount: number }) => sum + p.amount,
        0
      );
      const lastPaymentDate =
        debt.payments.length > 0 ? debt.payments[0].date : null;

      // Calculate months to payoff
      let monthsToPayoff: number | null = null;
      if (debt.minimumPayment && debt.minimumPayment > 0 && debt.remainingBalance > 0) {
        if (debt.interestRate > 0) {
          const monthlyRate = debt.interestRate / 100 / 12;
          const balance = debt.remainingBalance;
          const payment = debt.minimumPayment;
          if (payment > balance * monthlyRate) {
            monthsToPayoff = Math.ceil(
              -Math.log(1 - (monthlyRate * balance) / payment) /
                Math.log(1 + monthlyRate)
            );
          } else {
            monthsToPayoff = -1; // Payment too low to cover interest
          }
        } else {
          monthsToPayoff = Math.ceil(
            debt.remainingBalance / debt.minimumPayment
          );
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { payments, ...rest } = debt;

      return {
        ...rest,
        totalPaid,
        lastPaymentDate,
        monthsToPayoff,
        paymentCount: payments.length,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/debts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const {
      creditorName,
      description,
      originalAmount,
      remainingBalance,
      currency,
      interestRate,
      interestType,
      minimumPayment,
      dueDay,
      payoffDeadline,
      priority,
      status,
      isIslamic,
      autoPay,
      notes,
    } = body;

    if (!creditorName || originalAmount === undefined) {
      return NextResponse.json(
        { error: "creditorName and originalAmount are required" },
        { status: 400 }
      );
    }

    const debt = await prisma.debt.create({
      data: {
        userId: user.id,
        creditorName,
        description: description || null,
        originalAmount,
        remainingBalance: remainingBalance ?? originalAmount,
        currency: currency || user.primaryCurrency,
        interestRate: interestRate ?? 0,
        interestType: interestType || "none",
        minimumPayment: minimumPayment ?? null,
        dueDay: dueDay ?? null,
        payoffDeadline: payoffDeadline ? new Date(payoffDeadline) : null,
        priority: priority || "medium",
        status: status || "current",
        isIslamic: isIslamic || false,
        autoPay: autoPay || false,
        notes: notes || null,
      },
    });

    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("POST /api/debts error:", error);
    return NextResponse.json(
      { error: "Failed to create debt" },
      { status: 500 }
    );
  }
}
