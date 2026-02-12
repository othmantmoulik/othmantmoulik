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

    const payout = await prisma.pendingPayout.findFirst({
      where: { id, userId: user.id },
      include: {
        revenueStream: { select: { name: true, type: true, color: true } },
        client: true,
        linkedTransaction: true,
      },
    });

    if (!payout) {
      return NextResponse.json(
        { error: "Pending payout not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(payout);
  } catch (error) {
    console.error("GET /api/pending-payouts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending payout" },
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

    const existing = await prisma.pendingPayout.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Pending payout not found" },
        { status: 404 }
      );
    }

    // Handle "mark as received" flow
    if (body.status === "received" && existing.status !== "received") {
      const actualAmount = body.actualAmountReceived ?? existing.amount;
      const variance = actualAmount - existing.amount;

      const payout = await prisma.pendingPayout.update({
        where: { id },
        data: {
          status: "received",
          actualAmountReceived: actualAmount,
          variance,
          receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
          linkedTransactionId: body.linkedTransactionId || existing.linkedTransactionId,
          notes: body.notes !== undefined ? body.notes : existing.notes,
        },
        include: {
          revenueStream: { select: { name: true, type: true } },
          client: { select: { name: true } },
          linkedTransaction: true,
        },
      });

      return NextResponse.json(payout);
    }

    // General update
    const payout = await prisma.pendingPayout.update({
      where: { id },
      data: {
        revenueStreamId: body.revenueStreamId ?? existing.revenueStreamId,
        clientId: body.clientId !== undefined ? body.clientId : existing.clientId,
        amount: body.amount ?? existing.amount,
        currency: body.currency ?? existing.currency,
        convertedAmount: body.convertedAmount !== undefined ? body.convertedAmount : existing.convertedAmount,
        expectedDate: body.expectedDate
          ? new Date(body.expectedDate)
          : existing.expectedDate,
        periodCovered: body.periodCovered !== undefined ? body.periodCovered : existing.periodCovered,
        status: body.status ?? existing.status,
        confidence: body.confidence ?? existing.confidence,
        sourceDetail: body.sourceDetail !== undefined ? body.sourceDetail : existing.sourceDetail,
        actualAmountReceived: body.actualAmountReceived !== undefined
          ? body.actualAmountReceived
          : existing.actualAmountReceived,
        variance: body.variance !== undefined ? body.variance : existing.variance,
        receivedDate: body.receivedDate !== undefined
          ? body.receivedDate ? new Date(body.receivedDate) : null
          : existing.receivedDate,
        linkedTransactionId: body.linkedTransactionId !== undefined
          ? body.linkedTransactionId
          : existing.linkedTransactionId,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
      include: {
        revenueStream: { select: { name: true, type: true } },
        client: { select: { name: true } },
        linkedTransaction: true,
      },
    });

    return NextResponse.json(payout);
  } catch (error) {
    console.error("PUT /api/pending-payouts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update pending payout" },
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

    const existing = await prisma.pendingPayout.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Pending payout not found" },
        { status: 404 }
      );
    }

    await prisma.pendingPayout.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/pending-payouts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete pending payout" },
      { status: 500 }
    );
  }
}
