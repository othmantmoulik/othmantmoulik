import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseDateSafe(value: string | number | Date): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Excel serial date number
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(d.getTime())) return d;
    return null;
  }
  const s = String(value).trim();
  // Try ISO format
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Try DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1]);
    const month = parseInt(dmy[2]);
    const year = parseInt(dmy[3]);
    if (day > 12) {
      d = new Date(year, month - 1, day);
    } else if (month > 12) {
      d = new Date(year, day - 1, month);
    } else {
      // Ambiguous, prefer MM/DD/YYYY
      d = new Date(year, month - 1, day);
    }
    if (!isNaN(d.getTime())) return d;
  }
  // Try MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mdy) {
    let year = parseInt(mdy[3]);
    if (year < 100) year += 2000;
    d = new Date(year, parseInt(mdy[1]) - 1, parseInt(mdy[2]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "EUR", name: "Euro", symbol: "\u20ac" },
  { code: "GBP", name: "British Pound", symbol: "\u00a3" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BHD" },
  { code: "OMR", name: "Omani Rial", symbol: "OMR" },
  { code: "EGP", name: "Egyptian Pound", symbol: "EGP" },
  { code: "TRY", name: "Turkish Lira", symbol: "\u20ba" },
  { code: "INR", name: "Indian Rupee", symbol: "\u20b9" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "JPY", name: "Japanese Yen", symbol: "\u00a5" },
  { code: "CNY", name: "Chinese Yuan", symbol: "\u00a5" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
];

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "investment", label: "Investment" },
  { value: "cash", label: "Cash" },
  { value: "business", label: "Business" },
];

export const REVENUE_STREAM_TYPES = [
  { value: "retainer", label: "Retainer" },
  { value: "rev_share", label: "Revenue Share / Commission" },
  { value: "affiliate", label: "Affiliate / Recurring Referral" },
  { value: "project", label: "Project-Based / One-Time" },
  { value: "consulting", label: "Consulting / Hourly / Day Rate" },
  { value: "subscription", label: "Subscription / MRR" },
  { value: "product_sales", label: "Product Sales / Course Sales" },
  { value: "ad_revenue", label: "Ad Revenue / Media" },
];

export const PRIORITY_LEVELS = [
  { value: "critical", label: "Critical", color: "red" },
  { value: "high", label: "High", color: "orange" },
  { value: "medium", label: "Medium", color: "yellow" },
  { value: "low", label: "Low", color: "gray" },
];

export const PAYOUT_STATUSES = [
  { value: "expected", label: "Expected", color: "bg-blue-100 text-blue-800" },
  { value: "invoiced", label: "Invoiced", color: "bg-indigo-100 text-indigo-800" },
  { value: "confirmed", label: "Confirmed", color: "bg-purple-100 text-purple-800" },
  { value: "received", label: "Received", color: "bg-green-100 text-green-800" },
  { value: "late", label: "Late", color: "bg-red-100 text-red-800" },
  { value: "disputed", label: "Disputed", color: "bg-orange-100 text-orange-800" },
  { value: "written_off", label: "Written Off", color: "bg-gray-100 text-gray-800" },
];
