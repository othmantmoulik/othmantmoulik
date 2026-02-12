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

    let config = await prisma.waterfallConfig.findUnique({
      where: { userId: user.id },
    });

    if (!config) {
      config = await prisma.waterfallConfig.create({
        data: { userId: user.id },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("GET /api/allocation/config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch waterfall config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const config = await prisma.waterfallConfig.upsert({
      where: { userId: user.id },
      update: {
        debtStrategy: body.debtStrategy,
        safetyNetPct: body.safetyNetPct,
        debtPct: body.debtPct,
        goalsPct: body.goalsPct,
        investPct: body.investPct,
        funPct: body.funPct,
        readinessGateThreshold: body.readinessGateThreshold,
        investmentGateEnabled: body.investmentGateEnabled,
      },
      create: {
        userId: user.id,
        debtStrategy: body.debtStrategy ?? "deadline_first",
        safetyNetPct: body.safetyNetPct ?? 0.10,
        debtPct: body.debtPct ?? 0.20,
        goalsPct: body.goalsPct ?? 0.35,
        investPct: body.investPct ?? 0.10,
        funPct: body.funPct ?? 0.25,
        readinessGateThreshold: body.readinessGateThreshold ?? 70,
        investmentGateEnabled: body.investmentGateEnabled ?? true,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("PUT /api/allocation/config error:", error);
    return NextResponse.json(
      { error: "Failed to update waterfall config" },
      { status: 500 }
    );
  }
}
