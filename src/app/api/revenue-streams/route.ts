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

    const streams = await prisma.revenueStream.findMany({
      where: { userId: user.id },
      include: {
        client: { select: { name: true } },
        transactions: {
          where: { type: "income" },
          orderBy: { date: "desc" },
          select: { date: true, convertedAmount: true },
        },
        pendingPayouts: {
          where: { status: { in: ["expected", "invoiced", "confirmed"] } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = streams.map((stream: typeof streams[number]) => {
      const txDates = stream.transactions.map((t: { date: Date }) => t.date);
      const lastPayout = txDates.length > 0 ? txDates[0] : null;

      // Calculate average monthly income over last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentTx = stream.transactions.filter(
        (t: { date: Date }) => t.date >= sixMonthsAgo
      );
      const totalRecent = recentTx.reduce(
        (sum: number, t: { convertedAmount: number }) => sum + t.convertedAmount,
        0
      );
      const monthsSpan = Math.max(
        1,
        Math.min(
          6,
          recentTx.length > 0
            ? Math.ceil(
                (Date.now() - sixMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000)
              )
            : 1
        )
      );
      const avgMonthly = totalRecent / monthsSpan;

      const pendingCount = stream.pendingPayouts.length;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { transactions, pendingPayouts, ...rest } = stream;

      return {
        ...rest,
        lastPayout,
        avgMonthly: Math.round(avgMonthly * 100) / 100,
        pendingCount,
        totalTransactions: transactions.length,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/revenue-streams error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue streams" },
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
      type,
      status,
      clientId,
      currency,
      color,
      startDate,
      endDate,
      notes,
      streamVariables,
      linkedExpenseCategoryId,
      effortHoursPerWeek,
      effortLevel,
      scalability,
      strategicTag,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    const stream = await prisma.revenueStream.create({
      data: {
        userId: user.id,
        name,
        type,
        status: status || "active",
        clientId: clientId || null,
        currency: currency || user.primaryCurrency,
        color: color || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes || null,
        streamVariables: streamVariables
          ? typeof streamVariables === "string"
            ? streamVariables
            : JSON.stringify(streamVariables)
          : null,
        linkedExpenseCategoryId: linkedExpenseCategoryId || null,
        effortHoursPerWeek: effortHoursPerWeek ?? null,
        effortLevel: effortLevel || null,
        scalability: scalability || null,
        strategicTag: strategicTag || null,
      },
      include: {
        client: { select: { name: true } },
      },
    });

    return NextResponse.json(stream, { status: 201 });
  } catch (error) {
    console.error("POST /api/revenue-streams error:", error);
    return NextResponse.json(
      { error: "Failed to create revenue stream" },
      { status: 500 }
    );
  }
}
