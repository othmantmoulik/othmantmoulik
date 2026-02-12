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

    const bill = await prisma.fixedBill.findFirst({
      where: { id, userId: user.id },
      include: {
        paymentStatuses: {
          orderBy: { month: "desc" },
          take: 12,
        },
        linkedRevenueStream: {
          select: { name: true, type: true },
        },
      },
    });

    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(bill);
  } catch (error) {
    console.error("GET /api/bills/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bill" },
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

    const existing = await prisma.fixedBill.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    const bill = await prisma.fixedBill.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        amount: body.amount ?? existing.amount,
        currency: body.currency ?? existing.currency,
        dueDay: body.dueDay !== undefined ? body.dueDay : existing.dueDay,
        scope: body.scope ?? existing.scope,
        category: body.category !== undefined ? body.category : existing.category,
        isEssential: body.isEssential ?? existing.isEssential,
        isRevenueGenerating: body.isRevenueGenerating ?? existing.isRevenueGenerating,
        linkedRevenueStreamId: body.linkedRevenueStreamId !== undefined
          ? body.linkedRevenueStreamId
          : existing.linkedRevenueStreamId,
        paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod,
        autoPay: body.autoPay ?? existing.autoPay,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    });

    return NextResponse.json(bill);
  } catch (error) {
    console.error("PUT /api/bills/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update bill" },
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

    const existing = await prisma.fixedBill.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    // Delete payment statuses first
    await prisma.billPaymentStatus.deleteMany({ where: { fixedBillId: id } });
    await prisma.fixedBill.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/bills/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete bill" },
      { status: 500 }
    );
  }
}
