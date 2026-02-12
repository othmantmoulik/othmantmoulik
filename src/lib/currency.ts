import { prisma } from "./prisma";

const FRANKFURTER_API = "https://api.frankfurter.app";

export async function fetchAndStoreRates(base: string = "USD"): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const existing = await prisma.currencyRate.findFirst({
    where: { base, date: today },
  });
  if (existing) return;

  try {
    const res = await fetch(`${FRANKFURTER_API}/latest?from=${base}`);
    if (!res.ok) throw new Error(`Failed to fetch rates: ${res.status}`);
    const data = await res.json();
    const rates = data.rates as Record<string, number>;
    const ops = Object.entries(rates).map(([target, rate]) =>
      prisma.currencyRate.upsert({
        where: { base_target_date: { base, target, date: today } },
        update: { rate },
        create: { base, target, rate, date: today },
      })
    );
    await prisma.$transaction(ops);
  } catch (err) {
    console.error("Failed to fetch exchange rates:", err);
  }
}

export async function getRate(
  base: string,
  target: string,
  date?: string
): Promise<number> {
  if (base === target) return 1;

  const targetDate = date || new Date().toISOString().split("T")[0];

  // Try exact date
  let rate = await prisma.currencyRate.findFirst({
    where: { base, target, date: targetDate },
  });
  if (rate) return rate.rate;

  // Try reverse
  rate = await prisma.currencyRate.findFirst({
    where: { base: target, target: base, date: targetDate },
  });
  if (rate) return 1 / rate.rate;

  // Try most recent rate
  rate = await prisma.currencyRate.findFirst({
    where: { base, target },
    orderBy: { date: "desc" },
  });
  if (rate) return rate.rate;

  // Try reverse most recent
  rate = await prisma.currencyRate.findFirst({
    where: { base: target, target: base },
    orderBy: { date: "desc" },
  });
  if (rate) return 1 / rate.rate;

  // Cross rate through USD
  if (base !== "USD" && target !== "USD") {
    const baseToUsd = await getRate(base, "USD", date);
    const usdToTarget = await getRate("USD", target, date);
    if (baseToUsd && usdToTarget) return baseToUsd * usdToTarget;
  }

  return 1; // fallback
}

export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<{ converted: number; rate: number }> {
  const rate = await getRate(fromCurrency, toCurrency, date);
  return { converted: amount * rate, rate };
}
