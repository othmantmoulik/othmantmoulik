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

    const account = await prisma.account.findFirst({
      where: { id, userId: user.id },
      include: {
        transactions: {
          orderBy: { date: "desc" },
          take: 50,
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("GET /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
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

    const existing = await prisma.account.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        type: body.type ?? existing.type,
        currency: body.currency ?? existing.currency,
        balance: body.balance ?? existing.balance,
        institution: body.institution !== undefined ? body.institution : existing.institution,
        color: body.color !== undefined ? body.color : existing.color,
        icon: body.icon !== undefined ? body.icon : existing.icon,
        isActive: body.isActive ?? existing.isActive,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("PUT /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
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

    const existing = await prisma.account.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Soft delete by marking inactive
    await prisma.account.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
