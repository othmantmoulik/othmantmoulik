// Revenue Stream Projection Engine
// Analyzes historical data and generates forecasts

export interface MonthlyData {
  month: string; // YYYY-MM
  amount: number;
}

export interface PatternData {
  avgMonthly: number;
  weightedAvg: number;
  median: number;
  stdDev: number;
  consistencyScore: number;
  cv: number; // coefficient of variation
  trendDirection: "growing" | "stable" | "declining";
  avgGrowthRate: number;
  avgPaymentDay: number;
  paymentRegularity: number;
  seasonalFactors: Record<string, number>;
  lastCalculated: string;
}

export interface ProjectionResult {
  base: number;
  optimistic: number;
  pessimistic: number;
  confidence: "high" | "medium" | "low";
  basedOn: string;
}

export function calculatePatternData(history: MonthlyData[]): PatternData | null {
  if (history.length < 2) return null;

  const amounts = history.map((h) => h.amount);
  const n = amounts.length;

  // Basic metrics
  const avgMonthly = amounts.reduce((a, b) => a + b, 0) / n;

  // Weighted average (most recent weighted more)
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < n; i++) {
    const weight = i === n - 1 ? 0.4 : i === n - 2 ? 0.3 : i === n - 3 ? 0.2 : 0.1 / Math.max(1, n - 3);
    weightedSum += amounts[i] * weight;
    weightTotal += weight;
  }
  const weightedAvg = weightedSum / weightTotal;

  // Median
  const sorted = [...amounts].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Standard deviation
  const variance = amounts.reduce((sum, x) => sum + Math.pow(x - avgMonthly, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation
  const cv = avgMonthly > 0 ? stdDev / avgMonthly : 0;

  // Consistency score (0-100)
  const consistencyScore = Math.max(0, Math.round(100 - cv * 100));

  // Growth rates
  const growthRates: number[] = [];
  for (let i = 1; i < n; i++) {
    if (amounts[i - 1] > 0) {
      growthRates.push((amounts[i] - amounts[i - 1]) / amounts[i - 1]);
    }
  }
  const avgGrowthRate =
    growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;

  // Trend direction
  let trendDirection: "growing" | "stable" | "declining" = "stable";
  if (avgGrowthRate > 0.05) trendDirection = "growing";
  else if (avgGrowthRate < -0.05) trendDirection = "declining";

  // Seasonal factors (if enough data)
  const seasonalFactors: Record<string, number> = {};
  if (n >= 6) {
    const monthBuckets: Record<string, number[]> = {};
    for (const h of history) {
      const m = h.month.split("-")[1];
      if (!monthBuckets[m]) monthBuckets[m] = [];
      monthBuckets[m].push(h.amount);
    }
    for (const [m, vals] of Object.entries(monthBuckets)) {
      const monthAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
      seasonalFactors[m] = avgMonthly > 0 ? monthAvg / avgMonthly : 1;
    }
  }

  return {
    avgMonthly: Math.round(avgMonthly * 100) / 100,
    weightedAvg: Math.round(weightedAvg * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    consistencyScore,
    cv: Math.round(cv * 1000) / 1000,
    trendDirection,
    avgGrowthRate: Math.round(avgGrowthRate * 1000) / 1000,
    avgPaymentDay: 15, // Default, would need transaction dates to calculate
    paymentRegularity: consistencyScore,
    seasonalFactors,
    lastCalculated: new Date().toISOString(),
  };
}

export function generateProjection(
  type: string,
  variables: Record<string, unknown>,
  pattern: PatternData | null,
  months: number = 1
): ProjectionResult {
  let base = 0;
  let basedOn = "";

  switch (type) {
    case "retainer": {
      const monthlyAmount = (variables.monthly_amount as number) || 0;
      base = monthlyAmount * months;
      basedOn = `Fixed retainer: ${monthlyAmount}/month`;
      break;
    }
    case "rev_share": {
      if (pattern && pattern.avgMonthly > 0) {
        base = pattern.weightedAvg * (1 + pattern.avgGrowthRate) * months;
        basedOn = `Weighted avg: ${pattern.weightedAvg}/mo, Growth: ${(pattern.avgGrowthRate * 100).toFixed(1)}%`;
      } else {
        const rate = (variables.commission_rate as number) || 0;
        const estimate = (variables.estimated_monthly as number) || 0;
        base = estimate * rate * months;
        basedOn = "Estimate from commission rate";
      }
      break;
    }
    case "affiliate": {
      const perRef = (variables.commission_per_referral as number) || 0;
      const active = (variables.active_referrals as number) || 0;
      const churn = (variables.churn_rate as number) || 0.05;
      const newRefs = (variables.avg_new_monthly as number) || 0;
      let currentRefs = active;
      let total = 0;
      for (let i = 0; i < months; i++) {
        currentRefs = currentRefs * (1 - churn) + newRefs;
        total += currentRefs * perRef;
      }
      base = total;
      basedOn = `${active} active refs, ${(churn * 100).toFixed(0)}% churn, +${newRefs}/mo`;
      break;
    }
    case "project": {
      const milestones = (variables.milestones as Array<{ amount: number; status: string; expected_date: string }>) || [];
      base = milestones
        .filter((m) => m.status !== "paid")
        .reduce((sum, m) => sum + (m.amount || 0), 0);
      basedOn = `${milestones.filter((m) => m.status !== "paid").length} pending milestones`;
      break;
    }
    case "consulting": {
      const rate = (variables.rate as number) || 0;
      const avgUnits = (variables.avg_units_month as number) || 0;
      base = rate * avgUnits * months;
      basedOn = `${rate}/unit x ${avgUnits} units/mo`;
      break;
    }
    case "subscription": {
      const price = (variables.price as number) || 0;
      const subs = (variables.subscriber_count as number) || 0;
      const growth = (variables.growth_rate as number) || 0;
      const churn = (variables.churn_rate as number) || 0;
      let currentSubs = subs;
      let total = 0;
      for (let i = 0; i < months; i++) {
        currentSubs = currentSubs * (1 - churn) + currentSubs * growth;
        total += currentSubs * price;
      }
      base = total;
      basedOn = `${subs} subscribers, ${(growth * 100).toFixed(0)}% growth, ${(churn * 100).toFixed(0)}% churn`;
      break;
    }
    case "product_sales": {
      const price = (variables.price as number) || 0;
      const unitsSold = (variables.avg_units_month as number) || 0;
      const refundRate = (variables.refund_rate as number) || 0;
      const margin = (variables.profit_margin as number) || 1;
      base = price * unitsSold * (1 - refundRate) * margin * months;
      basedOn = `${unitsSold} units/mo at ${price}, ${(refundRate * 100).toFixed(0)}% refunds`;
      break;
    }
    case "ad_revenue": {
      if (pattern && pattern.avgMonthly > 0) {
        base = pattern.weightedAvg * months;
        basedOn = `Weighted avg from history: ${pattern.weightedAvg}/mo`;
      } else {
        base = (variables.avg_monthly_revenue as number) || 0;
        basedOn = "Estimate";
      }
      break;
    }
  }

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "low";
  if (pattern) {
    if (pattern.consistencyScore >= 70 && pattern.avgMonthly > 0) confidence = "high";
    else if (pattern.consistencyScore >= 40) confidence = "medium";
  }
  if (type === "retainer") confidence = "high";

  // Scenarios
  const optimistic = pattern
    ? Math.max(base * 1.2, (pattern.avgMonthly + pattern.stdDev) * months)
    : base * 1.2;
  const pessimistic = pattern
    ? Math.min(base * 0.7, Math.max(0, (pattern.avgMonthly - pattern.stdDev) * months))
    : base * 0.7;

  return {
    base: Math.round(base * 100) / 100,
    optimistic: Math.round(optimistic * 100) / 100,
    pessimistic: Math.round(pessimistic * 100) / 100,
    confidence,
    basedOn,
  };
}

// Allocation engine
export interface AllocationInput {
  cashReceived: number;
  overdueBills: Array<{ id: string; name: string; amount: number }>;
  essentialBills: Array<{ id: string; name: string; amount: number; dueDay: number }>;
  otherBills: Array<{ id: string; name: string; amount: number; dueDay: number }>;
  debts: Array<{
    id: string;
    name: string;
    remaining: number;
    minimumPayment: number;
    interestRate: number;
    deadline: string | null;
    isIslamic: boolean;
    priority: string;
  }>;
  goals: Array<{
    id: string;
    name: string;
    remaining: number;
    monthlyTarget: number;
    priority: string;
    targetDate: string | null;
  }>;
  safetyNetCurrent: number;
  safetyNetTarget: number;
  config: {
    debtStrategy: string;
    debtPct: number;
    safetyNetPct: number;
    goalsPct: number;
    investPct: number;
    funPct: number;
    readinessGateThreshold: number;
    investmentGateEnabled: boolean;
  };
  readinessScore: number;
}

export interface AllocationLineItem {
  targetType: string;
  targetId: string;
  targetName: string;
  amount: number;
  level: number;
  note: string;
}

export interface AllocationResult {
  totalBillsReserved: number;
  totalDebtAllocated: number;
  totalSafetyNet: number;
  totalGoals: number;
  totalInvest: number;
  totalFun: number;
  lineItems: AllocationLineItem[];
}

export function calculateAllocation(input: AllocationInput): AllocationResult {
  const lineItems: AllocationLineItem[] = [];
  let remaining = input.cashReceived;

  // LEVEL 1: Overdue obligations
  for (const bill of input.overdueBills) {
    const amount = Math.min(bill.amount, remaining);
    if (amount > 0) {
      lineItems.push({
        targetType: "bill",
        targetId: bill.id,
        targetName: bill.name,
        amount,
        level: 1,
        note: "OVERDUE",
      });
      remaining -= amount;
    }
  }

  // LEVEL 2: Essential bills
  let totalBills = 0;
  for (const bill of input.essentialBills) {
    const amount = Math.min(bill.amount, remaining);
    if (amount > 0) {
      lineItems.push({
        targetType: "bill",
        targetId: bill.id,
        targetName: bill.name,
        amount,
        level: 2,
        note: `Due day ${bill.dueDay}`,
      });
      remaining -= amount;
      totalBills += amount;
    }
  }

  // LEVEL 3: Other bills
  for (const bill of input.otherBills) {
    const amount = Math.min(bill.amount, remaining);
    if (amount > 0) {
      lineItems.push({
        targetType: "bill",
        targetId: bill.id,
        targetName: bill.name,
        amount,
        level: 3,
        note: `Due day ${bill.dueDay}`,
      });
      remaining -= amount;
      totalBills += amount;
    }
  }

  const afterBills = remaining;
  const { debtPct, safetyNetPct, goalsPct, investPct, funPct } = input.config;

  // Calculate allocations
  let debtAlloc = afterBills * debtPct;
  let safetyAlloc = afterBills * safetyNetPct;
  let goalsAlloc = afterBills * goalsPct;
  let investAlloc = afterBills * investPct;
  let funAlloc = afterBills * funPct;

  // Investment gate: if debt not cleared or safety net not full, redirect to debt
  const hasDebt = input.debts.some((d) => d.remaining > 0);
  const safetyNetFull = input.safetyNetCurrent >= input.safetyNetTarget;
  if (input.config.investmentGateEnabled && (hasDebt || !safetyNetFull)) {
    debtAlloc += investAlloc;
    investAlloc = 0;
  }

  // Safety net: skip if already full
  if (safetyNetFull) {
    goalsAlloc += safetyAlloc;
    safetyAlloc = 0;
  }

  // Fun money gate: redirect if readiness score below threshold
  if (input.readinessScore < input.config.readinessGateThreshold) {
    debtAlloc += funAlloc;
    funAlloc = 0;
  }

  // LEVEL 4: Debt paydown
  let totalDebt = 0;
  const sortedDebts = [...input.debts].filter((d) => d.remaining > 0);

  switch (input.config.debtStrategy) {
    case "avalanche":
      sortedDebts.sort((a, b) => b.interestRate - a.interestRate);
      break;
    case "snowball":
      sortedDebts.sort((a, b) => a.remaining - b.remaining);
      break;
    case "deadline_first":
    default:
      sortedDebts.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      break;
  }

  let debtRemaining = debtAlloc;
  for (const debt of sortedDebts) {
    const amount = Math.min(debt.remaining, debtRemaining);
    if (amount > 0) {
      const cleared = amount >= debt.remaining;
      lineItems.push({
        targetType: "debt",
        targetId: debt.id,
        targetName: debt.name,
        amount,
        level: 4,
        note: cleared ? "CLEAR IN FULL" : `Partial payment ($${(debt.remaining - amount).toFixed(0)} left)`,
      });
      debtRemaining -= amount;
      totalDebt += amount;
    }
  }

  // LEVEL 5: Safety net
  let totalSafety = 0;
  if (safetyAlloc > 0) {
    const needed = input.safetyNetTarget - input.safetyNetCurrent;
    const amount = Math.min(safetyAlloc, needed);
    if (amount > 0) {
      lineItems.push({
        targetType: "safety_net",
        targetId: "safety_net",
        targetName: "Safety Net",
        amount,
        level: 5,
        note: `Balance after: $${(input.safetyNetCurrent + amount).toFixed(0)} / $${input.safetyNetTarget.toFixed(0)}`,
      });
      totalSafety = amount;
    }
  }

  // LEVEL 6: Goals
  let totalGoals = 0;
  const sortedGoals = [...input.goals].filter((g) => g.remaining > 0);
  sortedGoals.sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.targetDate && b.targetDate) return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    return 0;
  });

  let goalRemaining = goalsAlloc;
  const totalPriWeight = sortedGoals.reduce((sum, g) => {
    const w = g.priority === "critical" ? 4 : g.priority === "high" ? 3 : g.priority === "medium" ? 2 : 1;
    return sum + w;
  }, 0);

  for (const goal of sortedGoals) {
    const w = goal.priority === "critical" ? 4 : goal.priority === "high" ? 3 : goal.priority === "medium" ? 2 : 1;
    const share = totalPriWeight > 0 ? (w / totalPriWeight) * goalsAlloc : 0;
    const amount = Math.min(share, goal.remaining, goalRemaining);
    if (amount > 0) {
      lineItems.push({
        targetType: "goal",
        targetId: goal.id,
        targetName: goal.name,
        amount,
        level: 6,
        note: `$${amount.toFixed(0)} added`,
      });
      goalRemaining -= amount;
      totalGoals += amount;
    }
  }

  // LEVEL 7: Investments
  let totalInvest = 0;
  if (investAlloc > 0) {
    lineItems.push({
      targetType: "investment",
      targetId: "investment",
      targetName: "Investments",
      amount: investAlloc,
      level: 7,
      note: "Investment allocation",
    });
    totalInvest = investAlloc;
  }

  // LEVEL 8: Fun money
  let totalFun = 0;
  if (funAlloc > 0) {
    lineItems.push({
      targetType: "fun",
      targetId: "fun",
      targetName: "Fun Money",
      amount: funAlloc,
      level: 8,
      note: input.readinessScore >= input.config.readinessGateThreshold
        ? "Available for discretionary spending"
        : "Redirected (readiness score below threshold)",
    });
    totalFun = funAlloc;
  }

  return {
    totalBillsReserved: totalBills + input.overdueBills.reduce((s, b) => s + Math.min(b.amount, input.cashReceived), 0),
    totalDebtAllocated: totalDebt,
    totalSafetyNet: totalSafety,
    totalGoals,
    totalInvest,
    totalFun,
    lineItems,
  };
}

// Cash flow gap detection
export interface CashFlowEvent {
  date: string;
  description: string;
  amount: number;
  type: "bill" | "debt" | "income_confirmed" | "income_pending" | "income_projected";
  confidence: "high" | "medium" | "low";
  relatedId?: string;
}

export interface CashFlowGap {
  date: string;
  shortfall: number;
  obligations: number;
  confirmedIncome: number;
  pendingIncome: number;
}

export function detectCashFlowGaps(
  startBalance: number,
  events: CashFlowEvent[],
  days: number = 90
): { timeline: Array<{ date: string; balance: number; confirmedBalance: number; events: CashFlowEvent[] }>; gaps: CashFlowGap[] } {
  const timeline: Array<{ date: string; balance: number; confirmedBalance: number; events: CashFlowEvent[] }> = [];
  const gaps: CashFlowGap[] = [];
  let balance = startBalance;
  let confirmedBalance = startBalance;

  const today = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const dayEvents = events.filter((e) => e.date === dateStr);
    let dayObligations = 0;
    let dayConfirmedIncome = 0;
    let dayPendingIncome = 0;

    for (const event of dayEvents) {
      if (event.amount < 0) {
        dayObligations += Math.abs(event.amount);
        balance += event.amount;
        confirmedBalance += event.amount;
      } else if (event.type === "income_confirmed") {
        dayConfirmedIncome += event.amount;
        balance += event.amount;
        confirmedBalance += event.amount;
      } else {
        dayPendingIncome += event.amount;
        balance += event.amount;
        // Don't add to confirmedBalance
      }
    }

    timeline.push({ date: dateStr, balance, confirmedBalance, events: dayEvents });

    if (confirmedBalance < 0) {
      gaps.push({
        date: dateStr,
        shortfall: Math.abs(confirmedBalance),
        obligations: dayObligations,
        confirmedIncome: dayConfirmedIncome,
        pendingIncome: dayPendingIncome,
      });
    }
  }

  return { timeline, gaps };
}

// Revenue sensitivity - what-if analysis
export interface WhatIfResult {
  streamName: string;
  monthlyImpact: number;
  canCoverBills: boolean;
  canCoverDebts: boolean;
  canCoverGoals: boolean;
  cashRunwayMonths: number;
  actionNeeded: string;
}

export function calculateWhatIf(
  streamToRemove: { name: string; monthlyRevenue: number },
  totalMonthlyRevenue: number,
  monthlyBills: number,
  monthlyDebtPayments: number,
  monthlyGoalContributions: number,
  currentSavings: number
): WhatIfResult {
  const remainingRevenue = totalMonthlyRevenue - streamToRemove.monthlyRevenue;
  const monthlyShortfall = Math.max(0, monthlyBills + monthlyDebtPayments + monthlyGoalContributions - remainingRevenue);
  const cashRunway = monthlyShortfall > 0 ? currentSavings / monthlyShortfall : Infinity;

  return {
    streamName: streamToRemove.name,
    monthlyImpact: streamToRemove.monthlyRevenue,
    canCoverBills: remainingRevenue >= monthlyBills,
    canCoverDebts: remainingRevenue >= monthlyBills + monthlyDebtPayments,
    canCoverGoals: remainingRevenue >= monthlyBills + monthlyDebtPayments + monthlyGoalContributions,
    cashRunwayMonths: Math.round(cashRunway * 10) / 10,
    actionNeeded:
      remainingRevenue >= monthlyBills + monthlyDebtPayments + monthlyGoalContributions
        ? "No immediate action needed"
        : remainingRevenue >= monthlyBills
          ? `Replace $${(monthlyBills + monthlyDebtPayments - remainingRevenue).toFixed(0)}/month or cut non-essential spending`
          : `CRITICAL: Replace $${(monthlyBills - remainingRevenue).toFixed(0)}/month to cover basic bills`,
  };
}

// Minimum revenue thresholds
export function calculateRevenueThresholds(
  essentialBills: number,
  allBills: number,
  debtPayments: number,
  safetyNetDeposit: number,
  goalContributions: number,
  funMoney: number,
  investAmount: number
): {
  survival: number;
  comfortable: number;
  growth: number;
  target: number;
} {
  return {
    survival: essentialBills,
    comfortable: allBills + debtPayments + safetyNetDeposit,
    growth: allBills + debtPayments + safetyNetDeposit + goalContributions,
    target: allBills + debtPayments + safetyNetDeposit + goalContributions + funMoney + investAmount,
  };
}
