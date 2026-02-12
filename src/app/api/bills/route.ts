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

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const user = await getUser();
    const currentMonth = getCurrentMonthKey();

    const bills = await prisma.fixedBill.findMany({
      where: { userId: user.id },
      include: {
        paymentStatuses: {
          where: { month: currentMonth },
          take: 1,
        },
        linkedRevenueStream: {
          select: { name: true, type: true },
        },
      },
      orderBy: [{ isEssential: "desc" }, { dueDay: "asc" }],
    });

    const enriched = bills.map((bill: typeof bills[number]) => {
      const currentStatus = bill.paymentStatuses[0] || null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { paymentStatuses, ...rest } = bill;

      return {
        ...rest,
        currentMonthStatus: currentStatus
          ? {
              status: currentStatus.status,
              paidDate: currentStatus.paidDate,
              paidAmount: currentStatus.paidAmount,
            }
          : { status: "upcoming", paidDate: null, paidAmount: null },
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/bills error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills" },
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
      amount,
      currency,
      dueDay,
      scope,
      category,
      isEssential,
      isRevenueGenerating,
      linkedRevenueStreamId,
      paymentMethod,
      autoPay,
      notes,
    } = body;

    if (!name || amount === undefined) {
      return NextResponse.json(
        { error: "Name and amount are required" },
        { status: 400 }
      );
    }

    const bill = await prisma.fixedBill.create({
      data: {
        userId: user.id,
        name,
        amount,
        currency: currency || user.primaryCurrency,
        dueDay: dueDay ?? null,
        scope: scope || "personal",
        category: category || null,
        isEssential: isEssential ?? true,
        isRevenueGenerating: isRevenueGenerating ?? false,
        linkedRevenueStreamId: linkedRevenueStreamId || null,
        paymentMethod: paymentMethod || null,
        autoPay: autoPay || false,
        notes: notes || null,
      },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error("POST /api/bills error:", error);
    return NextResponse.json(
      { error: "Failed to create bill" },
      { status: 500 }
    );
  }
}
