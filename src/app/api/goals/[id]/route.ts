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

    const goal = await prisma.goal.findFirst({
      where: { id, userId: user.id },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    const progressPct =
      goal.targetAmount > 0
        ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100)
        : 0;

    return NextResponse.json({
      ...goal,
      progressPct: Math.round(progressPct * 100) / 100,
      remaining: Math.max(0, goal.targetAmount - goal.savedAmount),
    });
  } catch (error) {
    console.error("GET /api/goals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal" },
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

    const existing = await prisma.goal.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        targetAmount: body.targetAmount ?? existing.targetAmount,
        currency: body.currency ?? existing.currency,
        savedAmount: body.savedAmount ?? existing.savedAmount,
        monthlyContribution: body.monthlyContribution !== undefined
          ? body.monthlyContribution
          : existing.monthlyContribution,
        targetDate: body.targetDate !== undefined
          ? body.targetDate ? new Date(body.targetDate) : null
          : existing.targetDate,
        priority: body.priority ?? existing.priority,
        bucket: body.bucket !== undefined ? body.bucket : existing.bucket,
        needVsWant: body.needVsWant !== undefined ? body.needVsWant : existing.needVsWant,
        status: body.status ?? existing.status,
      },
    });

    return NextResponse.json(goal);
  } catch (error) {
    console.error("PUT /api/goals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
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

    const existing = await prisma.goal.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    await prisma.goal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/goals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
