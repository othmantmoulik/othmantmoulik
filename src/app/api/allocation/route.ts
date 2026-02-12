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

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const user = await getUser();
    const currentMonth = getCurrentMonthKey();

    const plan = await prisma.allocationPlan.findFirst({
      where: { userId: user.id, month: currentMonth },
      orderBy: { createdAt: "desc" },
    });

    if (!plan) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      ...plan,
      lineItems: plan.lineItems ? JSON.parse(plan.lineItems) : [],
    });
  } catch (error) {
    console.error("GET /api/allocation error:", error);
    return NextResponse.json(
      { error: "Failed to fetch allocation plan" },
      { status: 500 }
    );
  }
}

interface LineItem {
  category: string;
  label: string;
  amount: number;
  relatedId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const { incomeAmount, triggerType, triggerTransactionId } = body;

    if (incomeAmount === undefined || incomeAmount <= 0) {
      return NextResponse.json(
        { error: "A positive incomeAmount is required" },
        { status: 400 }
      );
    }

    // Get waterfall config
    let config = await prisma.waterfallConfig.findUnique({
      where: { userId: user.id },
    });

    if (!config) {
      config = await prisma.waterfallConfig.create({
        data: {
          userId: user.id,
        },
      });
    }

    const currentMonth = getCurrentMonthKey();

    // Get bills for the month
    const bills = await prisma.fixedBill.findMany({
      where: { userId: user.id },
    });
    const totalBills = bills.reduce(
      (sum: number, b: { amount: number }) => sum + b.amount,
      0
    );

    // Get active debts
    const debts = await prisma.debt.findMany({
      where: { userId: user.id, status: { in: ["current", "partial", "overdue"] } },
      orderBy: [{ priority: "asc" }, { payoffDeadline: "asc" }],
    });

    // Get active goals
    const goals = await prisma.goal.findMany({
      where: { userId: user.id, status: "saving" },
      orderBy: [{ priority: "asc" }],
    });

    // Calculate allocations
    const afterBills = Math.max(0, incomeAmount - totalBills);

    const safetyNet = afterBills * config.safetyNetPct;
    const debtAlloc = afterBills * config.debtPct;
    const goalsAlloc = afterBills * config.goalsPct;
    const investAlloc = afterBills * config.investPct;
    const funAlloc = afterBills * config.funPct;

    const lineItems: LineItem[] = [];

    // Bills line items
    for (const b of bills) {
      lineItems.push({
        category: "bills",
        label: b.name,
        amount: b.amount,
        relatedId: b.id,
      });
    }

    // Safety net
    lineItems.push({
      category: "safety_net",
      label: "Emergency Fund",
      amount: Math.round(safetyNet * 100) / 100,
    });

    // Debt line items
    if (debts.length > 0) {
      let remaining = debtAlloc;
      for (const debt of debts) {
        const payment = Math.min(remaining, debt.minimumPayment || remaining);
        if (payment > 0) {
          lineItems.push({
            category: "debt",
            label: debt.creditorName,
            amount: Math.round(payment * 100) / 100,
            relatedId: debt.id,
          });
          remaining -= payment;
        }
        if (remaining <= 0) break;
      }
    }

    // Goal line items
    if (goals.length > 0) {
      const perGoal = goalsAlloc / goals.length;
      for (const g of goals) {
        lineItems.push({
          category: "goals",
          label: g.name,
          amount: Math.round(perGoal * 100) / 100,
          relatedId: g.id,
        });
      }
    }

    // Invest
    lineItems.push({
      category: "invest",
      label: "Investment",
      amount: Math.round(investAlloc * 100) / 100,
    });

    // Fun money
    lineItems.push({
      category: "fun",
      label: "Discretionary",
      amount: Math.round(funAlloc * 100) / 100,
    });

    const plan = await prisma.allocationPlan.create({
      data: {
        userId: user.id,
        triggerType: triggerType || "manual",
        triggerAmount: incomeAmount,
        triggerTransactionId: triggerTransactionId || null,
        month: currentMonth,
        totalIncome: incomeAmount,
        totalBillsReserved: Math.round(totalBills * 100) / 100,
        totalDebtAllocated: Math.round(debtAlloc * 100) / 100,
        totalSafetyNet: Math.round(safetyNet * 100) / 100,
        totalGoals: Math.round(goalsAlloc * 100) / 100,
        totalInvest: Math.round(investAlloc * 100) / 100,
        totalFun: Math.round(funAlloc * 100) / 100,
        lineItems: JSON.stringify(lineItems),
        status: "suggested",
      },
    });

    return NextResponse.json(
      {
        ...plan,
        lineItems,
        config: {
          safetyNetPct: config.safetyNetPct,
          debtPct: config.debtPct,
          goalsPct: config.goalsPct,
          investPct: config.investPct,
          funPct: config.funPct,
          debtStrategy: config.debtStrategy,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/allocation error:", error);
    return NextResponse.json(
      { error: "Failed to create allocation plan" },
      { status: 500 }
    );
  }
}
