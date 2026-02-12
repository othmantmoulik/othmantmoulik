import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const USER_ID = "demo-user";

export async function POST() {
  try {
    // Upsert demo user
    const user = await prisma.user.upsert({
      where: { id: USER_ID },
      update: {},
      create: { id: USER_ID, name: "Demo User", email: "demo@example.com" },
    });

    // Clean existing data
    await prisma.debtPayment.deleteMany({ where: { debt: { userId: user.id } } });
    await prisma.billPaymentStatus.deleteMany({ where: { userId: user.id } });
    await prisma.alert.deleteMany({ where: { userId: user.id } });
    await prisma.allocationPlan.deleteMany({ where: { userId: user.id } });
    await prisma.pendingPayout.deleteMany({ where: { userId: user.id } });
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.fixedBill.deleteMany({ where: { userId: user.id } });
    await prisma.debt.deleteMany({ where: { userId: user.id } });
    await prisma.goal.deleteMany({ where: { userId: user.id } });
    await prisma.revenueStream.deleteMany({ where: { userId: user.id } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.client.deleteMany({ where: { userId: user.id } });
    await prisma.waterfallConfig.deleteMany({ where: { userId: user.id } });

    // Create accounts
    const checkingAccount = await prisma.account.create({
      data: {
        userId: user.id,
        name: "Main Checking",
        type: "checking",
        currency: "USD",
        balance: 8450.00,
        institution: "Chase Bank",
        color: "#2563eb",
        icon: "building-columns",
      },
    });

    const savingsAccount = await prisma.account.create({
      data: {
        userId: user.id,
        name: "High-Yield Savings",
        type: "savings",
        currency: "USD",
        balance: 15200.00,
        institution: "Marcus",
        color: "#16a34a",
        icon: "piggy-bank",
      },
    });

    const businessAccount = await prisma.account.create({
      data: {
        userId: user.id,
        name: "Business Account",
        type: "business",
        currency: "USD",
        balance: 22300.00,
        institution: "Mercury",
        color: "#7c3aed",
        icon: "briefcase",
      },
    });

    const madAccount = await prisma.account.create({
      data: {
        userId: user.id,
        name: "Morocco Account",
        type: "checking",
        currency: "MAD",
        balance: 45000.00,
        institution: "Attijariwafa",
        color: "#dc2626",
        icon: "landmark",
      },
    });

    const creditCard = await prisma.account.create({
      data: {
        userId: user.id,
        name: "Chase Sapphire",
        type: "credit",
        currency: "USD",
        balance: -1850.00,
        institution: "Chase",
        color: "#0f172a",
        icon: "credit-card",
      },
    });

    // Create clients
    const client1 = await prisma.client.create({
      data: {
        userId: user.id,
        name: "TechCorp Inc",
        email: "billing@techcorp.com",
        company: "TechCorp Inc",
        notes: "Main retainer client",
      },
    });

    const client2 = await prisma.client.create({
      data: {
        userId: user.id,
        name: "StartupXYZ",
        email: "finance@startupxyz.io",
        company: "StartupXYZ",
      },
    });

    const client3 = await prisma.client.create({
      data: {
        userId: user.id,
        name: "MediaGroup",
        email: "payments@mediagroup.com",
        company: "Media Group LLC",
      },
    });

    // Create revenue streams
    const retainerStream = await prisma.revenueStream.create({
      data: {
        userId: user.id,
        name: "TechCorp Retainer",
        type: "retainer",
        status: "active",
        clientId: client1.id,
        currency: "USD",
        color: "#2563eb",
        startDate: new Date("2024-06-01"),
        streamVariables: JSON.stringify({
          monthlyAmount: 5000,
          invoiceDay: 1,
          paymentTerms: "net30",
        }),
        effortHoursPerWeek: 20,
        effortLevel: "medium",
        scalability: "linear",
        strategicTag: "core_business",
      },
    });

    const consultingStream = await prisma.revenueStream.create({
      data: {
        userId: user.id,
        name: "Startup Consulting",
        type: "consulting",
        status: "active",
        clientId: client2.id,
        currency: "USD",
        color: "#16a34a",
        startDate: new Date("2025-01-15"),
        streamVariables: JSON.stringify({
          hourlyRate: 150,
          estimatedHoursPerMonth: 20,
        }),
        effortHoursPerWeek: 5,
        effortLevel: "low",
        scalability: "linear",
        strategicTag: "side_income",
      },
    });

    const affiliateStream = await prisma.revenueStream.create({
      data: {
        userId: user.id,
        name: "SaaS Affiliate Program",
        type: "affiliate",
        status: "active",
        currency: "USD",
        color: "#f59e0b",
        startDate: new Date("2024-09-01"),
        streamVariables: JSON.stringify({
          platform: "PartnerStack",
          commissionRate: 0.25,
          recurringCommission: true,
        }),
        effortHoursPerWeek: 2,
        effortLevel: "minimal",
        scalability: "highly_scalable",
        strategicTag: "passive",
      },
    });

    const adStream = await prisma.revenueStream.create({
      data: {
        userId: user.id,
        name: "YouTube Ad Revenue",
        type: "ad_revenue",
        status: "active",
        clientId: client3.id,
        currency: "USD",
        color: "#ef4444",
        startDate: new Date("2024-03-01"),
        streamVariables: JSON.stringify({
          platform: "YouTube",
          avgCPM: 8.50,
          monthlyViews: 150000,
        }),
        effortHoursPerWeek: 10,
        effortLevel: "high",
        scalability: "partially",
        strategicTag: "core_business",
      },
    });

    const productStream = await prisma.revenueStream.create({
      data: {
        userId: user.id,
        name: "Online Course Sales",
        type: "product_sales",
        status: "active",
        currency: "USD",
        color: "#8b5cf6",
        startDate: new Date("2025-01-01"),
        streamVariables: JSON.stringify({
          platform: "Gumroad",
          coursePrice: 97,
          avgMonthlySales: 15,
        }),
        effortHoursPerWeek: 3,
        effortLevel: "low",
        scalability: "highly_scalable",
        strategicTag: "passive",
      },
    });

    // Create transactions (last 6 months)
    const txData: Array<{
      accountId: string;
      type: string;
      description: string;
      originalAmount: number;
      originalCurrency: string;
      convertedAmount: number;
      category: string;
      date: Date;
      revenueStreamId?: string;
    }> = [];

    // Generate income transactions
    for (let m = 5; m >= 0; m--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - m);

      // Retainer
      txData.push({
        accountId: businessAccount.id,
        type: "income",
        description: "TechCorp Monthly Retainer",
        originalAmount: 5000,
        originalCurrency: "USD",
        convertedAmount: 5000,
        category: "Retainer",
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 5),
        revenueStreamId: retainerStream.id,
      });

      // Consulting (variable)
      const consultHours = 15 + Math.floor(Math.random() * 10);
      txData.push({
        accountId: businessAccount.id,
        type: "income",
        description: `Startup Consulting - ${consultHours}hrs`,
        originalAmount: consultHours * 150,
        originalCurrency: "USD",
        convertedAmount: consultHours * 150,
        category: "Consulting",
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 15),
        revenueStreamId: consultingStream.id,
      });

      // Affiliate
      const affiliateAmount = 300 + Math.floor(Math.random() * 400);
      txData.push({
        accountId: checkingAccount.id,
        type: "income",
        description: "SaaS Affiliate Payout",
        originalAmount: affiliateAmount,
        originalCurrency: "USD",
        convertedAmount: affiliateAmount,
        category: "Affiliate",
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 20),
        revenueStreamId: affiliateStream.id,
      });

      // YouTube
      const ytAmount = 800 + Math.floor(Math.random() * 600);
      txData.push({
        accountId: checkingAccount.id,
        type: "income",
        description: "YouTube AdSense",
        originalAmount: ytAmount,
        originalCurrency: "USD",
        convertedAmount: ytAmount,
        category: "Ad Revenue",
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 22),
        revenueStreamId: adStream.id,
      });

      // Course sales
      const courseSales = 8 + Math.floor(Math.random() * 12);
      txData.push({
        accountId: checkingAccount.id,
        type: "income",
        description: `Online Course Sales (${courseSales} units)`,
        originalAmount: courseSales * 97,
        originalCurrency: "USD",
        convertedAmount: courseSales * 97,
        category: "Product Sales",
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 28),
        revenueStreamId: productStream.id,
      });

      // Expenses
      txData.push(
        {
          accountId: checkingAccount.id,
          type: "expense",
          description: "Rent Payment",
          originalAmount: 1800,
          originalCurrency: "USD",
          convertedAmount: 1800,
          category: "Housing",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
        },
        {
          accountId: checkingAccount.id,
          type: "expense",
          description: "Groceries",
          originalAmount: 350 + Math.floor(Math.random() * 150),
          originalCurrency: "USD",
          convertedAmount: 350 + Math.floor(Math.random() * 150),
          category: "Food",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 8),
        },
        {
          accountId: creditCard.id,
          type: "expense",
          description: "Software Subscriptions",
          originalAmount: 245,
          originalCurrency: "USD",
          convertedAmount: 245,
          category: "Software",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 3),
        },
        {
          accountId: creditCard.id,
          type: "expense",
          description: "Internet & Phone",
          originalAmount: 120,
          originalCurrency: "USD",
          convertedAmount: 120,
          category: "Utilities",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 10),
        },
        {
          accountId: checkingAccount.id,
          type: "expense",
          description: "Insurance",
          originalAmount: 350,
          originalCurrency: "USD",
          convertedAmount: 350,
          category: "Insurance",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 15),
        },
        {
          accountId: creditCard.id,
          type: "expense",
          description: "Dining & Entertainment",
          originalAmount: 200 + Math.floor(Math.random() * 200),
          originalCurrency: "USD",
          convertedAmount: 200 + Math.floor(Math.random() * 200),
          category: "Entertainment",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 18),
        },
        {
          accountId: checkingAccount.id,
          type: "expense",
          description: "Gas / Transportation",
          originalAmount: 150 + Math.floor(Math.random() * 100),
          originalCurrency: "USD",
          convertedAmount: 150 + Math.floor(Math.random() * 100),
          category: "Transportation",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 12),
        }
      );
    }

    // Create all transactions
    for (const tx of txData) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          accountId: tx.accountId,
          type: tx.type,
          description: tx.description,
          originalAmount: tx.originalAmount,
          originalCurrency: tx.originalCurrency,
          convertedAmount: tx.convertedAmount,
          conversionRate: 1.0,
          category: tx.category,
          date: tx.date,
          revenueStreamId: tx.revenueStreamId || null,
        },
      });
    }

    // Create debts
    const debt1 = await prisma.debt.create({
      data: {
        userId: user.id,
        creditorName: "Student Loan",
        description: "Federal student loan",
        originalAmount: 35000,
        remainingBalance: 18500,
        currency: "USD",
        interestRate: 4.5,
        interestType: "fixed",
        minimumPayment: 450,
        dueDay: 15,
        payoffDeadline: new Date("2029-06-01"),
        priority: "medium",
        status: "current",
      },
    });

    await prisma.debt.create({
      data: {
        userId: user.id,
        creditorName: "Credit Card Balance",
        description: "Chase Sapphire balance",
        originalAmount: 3200,
        remainingBalance: 1850,
        currency: "USD",
        interestRate: 18.99,
        interestType: "compound",
        minimumPayment: 85,
        dueDay: 25,
        priority: "high",
        status: "current",
      },
    });

    await prisma.debt.create({
      data: {
        userId: user.id,
        creditorName: "Family Loan",
        description: "Loan from family - no interest",
        originalAmount: 5000,
        remainingBalance: 3000,
        currency: "USD",
        interestRate: 0,
        interestType: "none",
        minimumPayment: 500,
        dueDay: 1,
        priority: "low",
        status: "current",
        isIslamic: true,
      },
    });

    // Create debt payments for student loan
    for (let m = 5; m >= 0; m--) {
      const payDate = new Date();
      payDate.setMonth(payDate.getMonth() - m);
      payDate.setDate(15);
      await prisma.debtPayment.create({
        data: {
          debtId: debt1.id,
          amount: 450,
          date: payDate,
          notes: "Monthly payment",
        },
      });
    }

    // Create bills
    await prisma.fixedBill.create({
      data: {
        userId: user.id,
        name: "Rent",
        amount: 1800,
        currency: "USD",
        dueDay: 1,
        scope: "personal",
        category: "Housing",
        isEssential: true,
      },
    });

    await prisma.fixedBill.create({
      data: {
        userId: user.id,
        name: "Internet & Phone",
        amount: 120,
        currency: "USD",
        dueDay: 10,
        scope: "personal",
        category: "Utilities",
        isEssential: true,
        autoPay: true,
      },
    });

    await prisma.fixedBill.create({
      data: {
        userId: user.id,
        name: "Insurance",
        amount: 350,
        currency: "USD",
        dueDay: 15,
        scope: "personal",
        category: "Insurance",
        isEssential: true,
        autoPay: true,
      },
    });

    await prisma.fixedBill.create({
      data: {
        userId: user.id,
        name: "Software Subscriptions",
        amount: 245,
        currency: "USD",
        dueDay: 3,
        scope: "business",
        category: "Software",
        isEssential: false,
        isRevenueGenerating: true,
        notes: "Figma, GitHub, Vercel, Notion, etc.",
      },
    });

    await prisma.fixedBill.create({
      data: {
        userId: user.id,
        name: "Gym Membership",
        amount: 50,
        currency: "USD",
        dueDay: 5,
        scope: "personal",
        category: "Health",
        isEssential: false,
      },
    });

    // Create goals
    await prisma.goal.create({
      data: {
        userId: user.id,
        name: "Emergency Fund (6 months)",
        targetAmount: 20000,
        currency: "USD",
        savedAmount: 15200,
        monthlyContribution: 800,
        targetDate: new Date("2026-06-01"),
        priority: "critical",
        bucket: "safety_net",
        needVsWant: "need",
        status: "saving",
      },
    });

    await prisma.goal.create({
      data: {
        userId: user.id,
        name: "MacBook Pro Upgrade",
        targetAmount: 3500,
        currency: "USD",
        savedAmount: 1200,
        monthlyContribution: 300,
        targetDate: new Date("2026-09-01"),
        priority: "medium",
        bucket: "fun_money",
        needVsWant: "want",
        status: "saving",
      },
    });

    await prisma.goal.create({
      data: {
        userId: user.id,
        name: "Investment Portfolio",
        targetAmount: 50000,
        currency: "USD",
        savedAmount: 8500,
        monthlyContribution: 1000,
        targetDate: new Date("2028-12-01"),
        priority: "high",
        bucket: "investment",
        needVsWant: "need",
        status: "saving",
      },
    });

    await prisma.goal.create({
      data: {
        userId: user.id,
        name: "Morocco Trip",
        targetAmount: 4000,
        currency: "USD",
        savedAmount: 2800,
        monthlyContribution: 400,
        targetDate: new Date("2026-08-01"),
        priority: "low",
        bucket: "fun_money",
        needVsWant: "want",
        status: "saving",
      },
    });

    // Create pending payouts
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await prisma.pendingPayout.create({
      data: {
        userId: user.id,
        revenueStreamId: retainerStream.id,
        clientId: client1.id,
        amount: 5000,
        currency: "USD",
        expectedDate: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5),
        periodCovered: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`,
        status: "confirmed",
        confidence: "high",
      },
    });

    await prisma.pendingPayout.create({
      data: {
        userId: user.id,
        revenueStreamId: consultingStream.id,
        clientId: client2.id,
        amount: 3000,
        currency: "USD",
        expectedDate: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 15),
        status: "invoiced",
        confidence: "high",
      },
    });

    await prisma.pendingPayout.create({
      data: {
        userId: user.id,
        revenueStreamId: affiliateStream.id,
        amount: 450,
        currency: "USD",
        expectedDate: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20),
        status: "expected",
        confidence: "medium",
      },
    });

    await prisma.pendingPayout.create({
      data: {
        userId: user.id,
        revenueStreamId: adStream.id,
        clientId: client3.id,
        amount: 1100,
        currency: "USD",
        expectedDate: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 22),
        status: "expected",
        confidence: "medium",
      },
    });

    // Create waterfall config
    await prisma.waterfallConfig.create({
      data: {
        userId: user.id,
        debtStrategy: "deadline_first",
        safetyNetPct: 0.10,
        debtPct: 0.20,
        goalsPct: 0.30,
        investPct: 0.15,
        funPct: 0.25,
      },
    });

    // Create alerts
    await prisma.alert.create({
      data: {
        userId: user.id,
        type: "concentration_risk",
        title: "Revenue Concentration Warning",
        message: "TechCorp Retainer accounts for over 40% of your income. Consider diversifying.",
        severity: "warning",
        relatedType: "revenue_stream",
        relatedId: retainerStream.id,
      },
    });

    await prisma.alert.create({
      data: {
        userId: user.id,
        type: "debt_off_track",
        title: "Credit Card Interest Alert",
        message: "Your credit card has an 18.99% APR. Consider increasing payments to save on interest.",
        severity: "warning",
        relatedType: "debt",
      },
    });

    await prisma.alert.create({
      data: {
        userId: user.id,
        type: "payout_overdue",
        title: "Emergency Fund Almost Complete",
        message: "You are 76% toward your emergency fund goal. Keep it up!",
        severity: "info",
        relatedType: "goal",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Database seeded with demo data",
      summary: {
        accounts: 5,
        clients: 3,
        revenueStreams: 5,
        transactions: txData.length,
        debts: 3,
        bills: 5,
        goals: 4,
        pendingPayouts: 4,
        alerts: 3,
      },
    });
  } catch (error) {
    console.error("POST /api/seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
