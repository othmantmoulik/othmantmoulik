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

    const clients = await prisma.client.findMany({
      where: { userId: user.id },
      include: {
        revenueStreams: {
          select: { id: true, name: true, type: true, status: true },
        },
        pendingPayouts: {
          where: { status: { in: ["expected", "invoiced", "confirmed"] } },
          select: { id: true, amount: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const enriched = clients.map((client: typeof clients[number]) => {
      const totalPending = client.pendingPayouts.reduce(
        (sum: number, p: { amount: number }) => sum + p.amount,
        0
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pendingPayouts, ...rest } = client;

      return {
        ...rest,
        activeStreams: client.revenueStreams.filter(
          (s: { status: string }) => s.status === "active"
        ).length,
        totalPendingPayouts: totalPending,
        pendingPayoutCount: pendingPayouts.length,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const { name, email, company, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name,
        email: email || null,
        company: company || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
