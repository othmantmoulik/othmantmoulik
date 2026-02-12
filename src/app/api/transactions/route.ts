import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertAmount } from "@/lib/currency";

const USER_ID = "demo-user";
async function getUser() {
  return prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, name: "Demo User", email: "demo@example.com" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    const { searchParams } = new URL(request.url);

    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const category = searchParams.get("category");
    const revenueStreamId = searchParams.get("revenueStreamId");
    const search = searchParams.get("search");
    const skip = parseInt(searchParams.get("skip") || "0");
    const take = parseInt(searchParams.get("take") || "50");

    const where: Record<string, unknown> = { userId: user.id };

    if (accountId) where.accountId = accountId;
    if (type) where.type = type;
    if (category) where.category = category;
    if (revenueStreamId) where.revenueStreamId = revenueStreamId;

    if (dateFrom || dateTo) {
      where.date = {} as Record<string, Date>;
      if (dateFrom) (where.date as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, Date>).lte = new Date(dateTo);
    }

    if (search) {
      where.description = { contains: search };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { name: true, currency: true } },
          revenueStream: { select: { name: true, type: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      total,
      skip,
      take,
      hasMore: skip + take < total,
    });
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const {
      accountId,
      type,
      description,
      originalAmount,
      originalCurrency,
      category,
      date,
      revenueStreamId,
      notes,
    } = body;

    if (!accountId || !type || !description || originalAmount === undefined) {
      return NextResponse.json(
        { error: "accountId, type, description, and originalAmount are required" },
        { status: 400 }
      );
    }

    // Get account to determine currency if not provided
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const txCurrency = originalCurrency || account.currency;

    // Convert to primary currency
    const { converted, rate } = await convertAmount(
      originalAmount,
      txCurrency,
      user.primaryCurrency,
      date ? new Date(date).toISOString().split("T")[0] : undefined
    );

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId,
        type,
        description,
        originalAmount,
        originalCurrency: txCurrency,
        convertedAmount: converted,
        conversionRate: rate,
        category: category || null,
        date: date ? new Date(date) : new Date(),
        revenueStreamId: revenueStreamId || null,
        notes: notes || null,
      },
      include: {
        account: { select: { name: true, currency: true } },
        revenueStream: { select: { name: true, type: true } },
      },
    });

    // Update account balance
    const balanceChange = type === "income" ? originalAmount : -originalAmount;
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: balanceChange } },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("POST /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
