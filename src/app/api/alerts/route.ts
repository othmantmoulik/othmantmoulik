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

    const alerts = await prisma.alert.findMany({
      where: {
        userId: user.id,
        isDismissed: false,
      },
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("GET /api/alerts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const { id, ids, isRead, isDismissed } = body;

    // Support both single and bulk updates
    const alertIds: string[] = ids || (id ? [id] : []);

    if (alertIds.length === 0) {
      return NextResponse.json(
        { error: "id or ids required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (isRead !== undefined) updateData.isRead = isRead;
    if (isDismissed !== undefined) updateData.isDismissed = isDismissed;

    await prisma.alert.updateMany({
      where: {
        id: { in: alertIds },
        userId: user.id,
      },
      data: updateData,
    });

    return NextResponse.json({ success: true, updated: alertIds.length });
  } catch (error) {
    console.error("PUT /api/alerts error:", error);
    return NextResponse.json(
      { error: "Failed to update alerts" },
      { status: 500 }
    );
  }
}
