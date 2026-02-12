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

interface StreamIncome {
  id: string;
  name: string;
  type: string;
  avgMonthly: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const { removeStreamIds, addIncome, removeIncome, timeframeMonths } = body;

    const months = timeframeMonths || 12;

    // Get current revenue data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const streams = await prisma.revenueStream.findMany({
      where: { userId: user.id, status: "active" },
      include: {
        transactions: {
          where: { type: "income", date: { gte: sixMonthsAgo } },
          select: { convertedAmount: true },
        },
      },
    });

    // Calculate current monthly income per stream
    const streamIncome: StreamIncome[] = streams.map(
      (stream: typeof streams[number]) => {
        const total = stream.transactions.reduce(
          (sum: number, t: { convertedAmount: number }) => sum + t.convertedAmount,
          0
        );
        const avgMonthly = total / 6;
        return {
          id: stream.id,
          name: stream.name,
          type: stream.type,
          avgMonthly: Math.round(avgMonthly * 100) / 100,
        };
      }
    );

    const totalCurrentMonthly = streamIncome.reduce(
      (sum: number, s: StreamIncome) => sum + s.avgMonthly,
      0
    );

    // Calculate scenario
    let scenarioMonthly = totalCurrentMonthly;

    // Remove streams
    const removedStreams: Array<{ name: string; avgMonthly: number }> = [];
    if (removeStreamIds && removeStreamIds.length > 0) {
      for (const rmId of removeStreamIds as string[]) {
        const stream = streamIncome.find((s: StreamIncome) => s.id === rmId);
        if (stream) {
          scenarioMonthly -= stream.avgMonthly;
          removedStreams.push({
            name: stream.name,
            avgMonthly: stream.avgMonthly,
          });
        }
      }
    }

    // Add/remove flat income
    if (addIncome) scenarioMonthly += addIncome;
    if (removeIncome) scenarioMonthly -= removeIncome;

    // Get monthly expenses
    const expenses = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: "expense",
        date: { gte: sixMonthsAgo },
      },
      select: { convertedAmount: true },
    });
    const totalExpenses = expenses.reduce(
      (sum: number, t: { convertedAmount: number }) => sum + t.convertedAmount,
      0
    );
    const avgMonthlyExpenses = totalExpenses / 6;

    // Get bills
    const bills = await prisma.fixedBill.findMany({
      where: { userId: user.id },
    });
    const monthlyBills = bills.reduce(
      (sum: number, b: { amount: number }) => sum + b.amount,
      0
    );

    // Get debts
    const debts = await prisma.debt.findMany({
      where: { userId: user.id, status: { in: ["current", "partial", "overdue"] } },
    });
    const monthlyDebt = debts.reduce(
      (sum: number, d: { minimumPayment: number | null }) =>
        sum + (d.minimumPayment || 0),
      0
    );

    const currentSurplus = totalCurrentMonthly - avgMonthlyExpenses;
    const scenarioSurplus = scenarioMonthly - avgMonthlyExpenses;

    const projectedCumulativeImpact = (scenarioMonthly - totalCurrentMonthly) * months;

    // Concentration risk
    const maxStreamPct =
      streamIncome.length > 0
        ? Math.max(
            ...streamIncome.map(
              (s: StreamIncome) =>
                totalCurrentMonthly > 0 ? (s.avgMonthly / totalCurrentMonthly) * 100 : 0
            )
          )
        : 0;

    const scenarioStreams = streamIncome.filter(
      (s: StreamIncome) => !removeStreamIds?.includes(s.id)
    );
    const scenarioMaxPct =
      scenarioStreams.length > 0 && scenarioMonthly > 0
        ? Math.max(
            ...scenarioStreams.map(
              (s: StreamIncome) => (s.avgMonthly / scenarioMonthly) * 100
            )
          )
        : 0;

    return NextResponse.json({
      current: {
        monthlyIncome: Math.round(totalCurrentMonthly * 100) / 100,
        monthlyExpenses: Math.round(avgMonthlyExpenses * 100) / 100,
        monthlySurplus: Math.round(currentSurplus * 100) / 100,
        monthlyBills: Math.round(monthlyBills * 100) / 100,
        monthlyDebt: Math.round(monthlyDebt * 100) / 100,
        streamCount: streamIncome.length,
        maxConcentration: Math.round(maxStreamPct * 100) / 100,
      },
      scenario: {
        monthlyIncome: Math.round(scenarioMonthly * 100) / 100,
        monthlyExpenses: Math.round(avgMonthlyExpenses * 100) / 100,
        monthlySurplus: Math.round(scenarioSurplus * 100) / 100,
        streamCount: scenarioStreams.length,
        maxConcentration: Math.round(scenarioMaxPct * 100) / 100,
        removedStreams,
      },
      impact: {
        monthlyDifference: Math.round((scenarioMonthly - totalCurrentMonthly) * 100) / 100,
        projectedCumulativeImpact: Math.round(projectedCumulativeImpact * 100) / 100,
        timeframeMonths: months,
        canCoverBills: scenarioMonthly >= monthlyBills,
        canCoverBillsAndDebt: scenarioMonthly >= monthlyBills + monthlyDebt,
        riskLevel:
          scenarioSurplus < 0
            ? "critical"
            : scenarioSurplus < avgMonthlyExpenses * 0.2
            ? "high"
            : scenarioSurplus < avgMonthlyExpenses * 0.5
            ? "medium"
            : "low",
      },
      streams: streamIncome,
    });
  } catch (error) {
    console.error("POST /api/what-if error:", error);
    return NextResponse.json(
      { error: "Failed to calculate scenario" },
      { status: 500 }
    );
  }
}
