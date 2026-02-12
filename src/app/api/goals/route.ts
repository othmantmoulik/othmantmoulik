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

    const goals = await prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "asc" }, { targetDate: "asc" }],
    });

    const enriched = goals.map((goal: typeof goals[number]) => {
      const progressPct =
        goal.targetAmount > 0
          ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100)
          : 0;

      const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);

      // Calculate if on track
      let isOnTrack: boolean | null = null;
      if (goal.targetDate && goal.monthlyContribution && goal.monthlyContribution > 0) {
        const now = new Date();
        const target = new Date(goal.targetDate);
        const monthsLeft = Math.max(
          0,
          (target.getFullYear() - now.getFullYear()) * 12 +
            (target.getMonth() - now.getMonth())
        );

        if (monthsLeft > 0) {
          const requiredMonthly = remaining / monthsLeft;
          isOnTrack = goal.monthlyContribution >= requiredMonthly;
        } else {
          isOnTrack = remaining <= 0;
        }
      }

      return {
        ...goal,
        progressPct: Math.round(progressPct * 100) / 100,
        remaining,
        isOnTrack,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/goals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const {
      name,
      targetAmount,
      currency,
      savedAmount,
      monthlyContribution,
      targetDate,
      priority,
      bucket,
      needVsWant,
      status,
    } = body;

    if (!name || targetAmount === undefined) {
      return NextResponse.json(
        { error: "Name and targetAmount are required" },
        { status: 400 }
      );
    }

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        name,
        targetAmount,
        currency: currency || user.primaryCurrency,
        savedAmount: savedAmount ?? 0,
        monthlyContribution: monthlyContribution ?? null,
        targetDate: targetDate ? new Date(targetDate) : null,
        priority: priority || "medium",
        bucket: bucket || null,
        needVsWant: needVsWant || null,
        status: status || "saving",
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("POST /api/goals error:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
