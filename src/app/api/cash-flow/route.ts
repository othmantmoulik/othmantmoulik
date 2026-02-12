import { NextResponse } from "next/server";
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

interface CashFlowEvent {
  date: string;
  type: "income" | "expense" | "debt" | "bill";
  description: string;
  amount: number;
  confidence: string;
  sourceType: string;
  sourceId?: string;
}

export async function GET() {
  try {
    const user = await getUser();
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    const events: CashFlowEvent[] = [];

    // 1. Pending payouts (expected income)
    const pendingPayouts = await prisma.pendingPayout.findMany({
      where: {
        userId: user.id,
        status: { in: ["expected", "invoiced", "confirmed"] },
        expectedDate: { gte: now, lte: endDate },
      },
      include: {
        revenueStream: { select: { name: true, currency: true } },
      },
    });

    for (const payout of pendingPayouts) {
      let amount = payout.amount;
      if (payout.currency !== user.primaryCurrency) {
        const { converted } = await convertAmount(
          payout.amount,
          payout.currency,
          user.primaryCurrency
        );
        amount = converted;
      }

      events.push({
        date: payout.expectedDate.toISOString().split("T")[0],
        type: "income",
        description: `${payout.revenueStream.name} payout`,
        amount: Math.round(amount * 100) / 100,
        confidence: payout.confidence,
        sourceType: "pending_payout",
        sourceId: payout.id,
      });
    }

    // 2. Bills (recurring expenses)
    const bills = await prisma.fixedBill.findMany({
      where: { userId: user.id },
    });

    for (const bill of bills) {
      let amount = bill.amount;
      if (bill.currency !== user.primaryCurrency) {
        const { converted } = await convertAmount(
          bill.amount,
          bill.currency,
          user.primaryCurrency
        );
        amount = converted;
      }

      // Project the next 3 months
      for (let m = 0; m < 3; m++) {
        const projDate = new Date(now);
        projDate.setMonth(projDate.getMonth() + m);
        if (bill.dueDay) {
          projDate.setDate(bill.dueDay);
        }

        if (projDate >= now && projDate <= endDate) {
          events.push({
            date: projDate.toISOString().split("T")[0],
            type: "bill",
            description: bill.name,
            amount: Math.round(amount * 100) / 100,
            confidence: "high",
            sourceType: "bill",
            sourceId: bill.id,
          });
        }
      }
    }

    // 3. Debt payments
    const debts = await prisma.debt.findMany({
      where: {
        userId: user.id,
        status: { in: ["current", "partial", "overdue"] },
      },
    });

    for (const debt of debts) {
      if (!debt.minimumPayment) continue;

      let amount = debt.minimumPayment;
      if (debt.currency !== user.primaryCurrency) {
        const { converted } = await convertAmount(
          debt.minimumPayment,
          debt.currency,
          user.primaryCurrency
        );
        amount = converted;
      }

      for (let m = 0; m < 3; m++) {
        const projDate = new Date(now);
        projDate.setMonth(projDate.getMonth() + m);
        if (debt.dueDay) {
          projDate.setDate(debt.dueDay);
        }

        if (projDate >= now && projDate <= endDate) {
          events.push({
            date: projDate.toISOString().split("T")[0],
            type: "debt",
            description: `${debt.creditorName} payment`,
            amount: Math.round(amount * 100) / 100,
            confidence: "high",
            sourceType: "debt",
            sourceId: debt.id,
          });
        }
      }
    }

    // 4. Projected income from active streams (based on historical patterns)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const streams = await prisma.revenueStream.findMany({
      where: { userId: user.id, status: "active" },
      include: {
        transactions: {
          where: { type: "income", date: { gte: sixMonthsAgo } },
          select: { convertedAmount: true, date: true },
          orderBy: { date: "desc" },
        },
      },
    });

    for (const stream of streams) {
      if (stream.transactions.length === 0) continue;

      const totalIncome = stream.transactions.reduce(
        (sum: number, t: { convertedAmount: number }) => sum + t.convertedAmount,
        0
      );
      const avgMonthly = totalIncome / 6;

      // Only project if not already covered by pending payouts
      const hasPendingPayout = pendingPayouts.some(
        (p: { revenueStreamId: string }) => p.revenueStreamId === stream.id
      );

      if (!hasPendingPayout && avgMonthly > 0) {
        for (let m = 1; m <= 3; m++) {
          const projDate = new Date(now);
          projDate.setMonth(projDate.getMonth() + m);
          projDate.setDate(15); // mid-month estimate

          if (projDate <= endDate) {
            events.push({
              date: projDate.toISOString().split("T")[0],
              type: "income",
              description: `${stream.name} (projected)`,
              amount: Math.round(avgMonthly * 100) / 100,
              confidence: "low",
              sourceType: "projected_income",
              sourceId: stream.id,
            });
          }
        }
      }
    }

    // Sort events by date
    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate running balance
    const accounts = await prisma.account.findMany({
      where: { userId: user.id, isActive: true },
    });

    let runningBalance = 0;
    for (const account of accounts) {
      if (account.currency === user.primaryCurrency) {
        runningBalance += account.balance;
      } else {
        const { converted } = await convertAmount(
          account.balance,
          account.currency,
          user.primaryCurrency
        );
        runningBalance += converted;
      }
    }

    const startingBalance = Math.round(runningBalance * 100) / 100;
    const timeline = events.map((event) => {
      if (event.type === "income") {
        runningBalance += event.amount;
      } else {
        runningBalance -= event.amount;
      }

      return {
        ...event,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    // Find lowest point
    let lowestBalance = startingBalance;
    let lowestDate = now.toISOString().split("T")[0];
    for (const entry of timeline) {
      if (entry.runningBalance < lowestBalance) {
        lowestBalance = entry.runningBalance;
        lowestDate = entry.date;
      }
    }

    return NextResponse.json({
      startingBalance,
      endingBalance: timeline.length > 0
        ? timeline[timeline.length - 1].runningBalance
        : startingBalance,
      lowestBalance: Math.round(lowestBalance * 100) / 100,
      lowestDate,
      totalIncoming: Math.round(
        events
          .filter((e) => e.type === "income")
          .reduce((sum, e) => sum + e.amount, 0) * 100
      ) / 100,
      totalOutgoing: Math.round(
        events
          .filter((e) => e.type !== "income")
          .reduce((sum, e) => sum + e.amount, 0) * 100
      ) / 100,
      eventCount: events.length,
      timeline,
      currency: user.primaryCurrency,
    });
  } catch (error) {
    console.error("GET /api/cash-flow error:", error);
    return NextResponse.json(
      { error: "Failed to generate cash flow timeline" },
      { status: 500 }
    );
  }
}
