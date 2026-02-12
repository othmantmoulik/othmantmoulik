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

    const waterfallConfig = await prisma.waterfallConfig.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      primaryCurrency: user.primaryCurrency,
      createdAt: user.createdAt,
      waterfallConfig: waterfallConfig || {
        debtStrategy: "deadline_first",
        safetyNetPct: 0.10,
        debtPct: 0.20,
        goalsPct: 0.35,
        investPct: 0.10,
        funPct: 0.25,
        readinessGateThreshold: 70,
        investmentGateEnabled: true,
      },
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name;
    if (body.email) updates.email = body.email;
    if (body.primaryCurrency) updates.primaryCurrency = body.primaryCurrency;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });

    // Update waterfall config if provided
    if (body.waterfallConfig) {
      await prisma.waterfallConfig.upsert({
        where: { userId: user.id },
        update: body.waterfallConfig,
        create: {
          userId: user.id,
          ...body.waterfallConfig,
        },
      });
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      primaryCurrency: updatedUser.primaryCurrency,
    });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
