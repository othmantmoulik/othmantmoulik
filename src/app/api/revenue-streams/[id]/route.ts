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

    const stream = await prisma.revenueStream.findFirst({
      where: { id, userId: user.id },
      include: {
        client: true,
        transactions: {
          orderBy: { date: "desc" },
          take: 100,
          include: {
            account: { select: { name: true, currency: true } },
          },
        },
        pendingPayouts: {
          orderBy: { expectedDate: "desc" },
        },
        linkedBills: true,
      },
    });

    if (!stream) {
      return NextResponse.json(
        { error: "Revenue stream not found" },
        { status: 404 }
      );
    }

    // Parse pattern data
    const patternData = stream.patternData
      ? JSON.parse(stream.patternData)
      : null;

    // Calculate pending payouts summary
    const pendingPayoutsData = stream.pendingPayouts.filter(
      (p: { status: string }) => p.status !== "received" && p.status !== "written_off"
    );

    return NextResponse.json({
      ...stream,
      patternData,
      pendingPayoutsSummary: {
        count: pendingPayoutsData.length,
        totalExpected: pendingPayoutsData.reduce(
          (sum: number, p: { amount: number }) => sum + p.amount,
          0
        ),
      },
    });
  } catch (error) {
    console.error("GET /api/revenue-streams/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue stream" },
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

    const existing = await prisma.revenueStream.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Revenue stream not found" },
        { status: 404 }
      );
    }

    const stream = await prisma.revenueStream.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        type: body.type ?? existing.type,
        status: body.status ?? existing.status,
        clientId: body.clientId !== undefined ? body.clientId : existing.clientId,
        currency: body.currency ?? existing.currency,
        color: body.color !== undefined ? body.color : existing.color,
        startDate: body.startDate !== undefined
          ? body.startDate ? new Date(body.startDate) : null
          : existing.startDate,
        endDate: body.endDate !== undefined
          ? body.endDate ? new Date(body.endDate) : null
          : existing.endDate,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        streamVariables: body.streamVariables !== undefined
          ? typeof body.streamVariables === "string"
            ? body.streamVariables
            : JSON.stringify(body.streamVariables)
          : existing.streamVariables,
        linkedExpenseCategoryId:
          body.linkedExpenseCategoryId !== undefined
            ? body.linkedExpenseCategoryId
            : existing.linkedExpenseCategoryId,
        patternData: body.patternData !== undefined
          ? typeof body.patternData === "string"
            ? body.patternData
            : JSON.stringify(body.patternData)
          : existing.patternData,
        effortHoursPerWeek:
          body.effortHoursPerWeek !== undefined
            ? body.effortHoursPerWeek
            : existing.effortHoursPerWeek,
        effortLevel: body.effortLevel !== undefined ? body.effortLevel : existing.effortLevel,
        scalability: body.scalability !== undefined ? body.scalability : existing.scalability,
        strategicTag: body.strategicTag !== undefined ? body.strategicTag : existing.strategicTag,
      },
      include: {
        client: { select: { name: true } },
      },
    });

    return NextResponse.json(stream);
  } catch (error) {
    console.error("PUT /api/revenue-streams/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update revenue stream" },
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

    const existing = await prisma.revenueStream.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Revenue stream not found" },
        { status: 404 }
      );
    }

    await prisma.revenueStream.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/revenue-streams/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete revenue stream" },
      { status: 500 }
    );
  }
}
