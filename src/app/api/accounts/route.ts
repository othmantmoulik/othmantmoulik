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

export async function GET() {
  try {
    const user = await getUser();

    const accounts = await prisma.account.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const accountsWithConverted = await Promise.all(
      accounts.map(async (account: typeof accounts[number]) => {
        if (account.currency === user.primaryCurrency) {
          return { ...account, convertedBalance: account.balance };
        }
        const { converted } = await convertAmount(
          account.balance,
          account.currency,
          user.primaryCurrency
        );
        return { ...account, convertedBalance: converted };
      })
    );

    return NextResponse.json(accountsWithConverted);
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const body = await request.json();

    const { name, type, currency, balance, institution, color, icon } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        name,
        type,
        currency: currency || user.primaryCurrency,
        balance: balance || 0,
        institution: institution || null,
        color: color || null,
        icon: icon || null,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
