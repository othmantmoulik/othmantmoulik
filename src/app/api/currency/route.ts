import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAndStoreRates } from "@/lib/currency";

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

    // Fetch and store latest rates
    await fetchAndStoreRates(user.primaryCurrency);

    const today = new Date().toISOString().split("T")[0];

    const rates = await prisma.currencyRate.findMany({
      where: { base: user.primaryCurrency, date: today },
      orderBy: { target: "asc" },
    });

    return NextResponse.json({
      base: user.primaryCurrency,
      date: today,
      rates,
    });
  } catch (error) {
    console.error("GET /api/currency error:", error);
    return NextResponse.json(
      { error: "Failed to fetch currency rates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await getUser();
    const body = await request.json();

    const { base, target, rate, date } = body;

    if (!base || !target || rate === undefined) {
      return NextResponse.json(
        { error: "base, target, and rate are required" },
        { status: 400 }
      );
    }

    const rateDate = date || new Date().toISOString().split("T")[0];

    const currencyRate = await prisma.currencyRate.upsert({
      where: {
        base_target_date: { base, target, date: rateDate },
      },
      update: { rate },
      create: { base, target, rate, date: rateDate },
    });

    return NextResponse.json(currencyRate, { status: 201 });
  } catch (error) {
    console.error("POST /api/currency error:", error);
    return NextResponse.json(
      { error: "Failed to save currency rate" },
      { status: 500 }
    );
  }
}
