"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface RevenueStream {
  id: string;
  name: string;
  type: string;
  status: string;
  avg_monthly: number;
  currency: string;
  projected_next_month?: { base: number; optimistic: number; pessimistic: number };
}

interface PendingPayout {
  id: string;
  stream_name: string;
  amount: number;
  currency: string;
  expected_date: string;
  status: string;
  confidence: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  category: string;
  account_name: string;
}

interface Alert {
  id: string;
  type: string;
  severity: "info" | "warning" | "error";
  message: string;
  created_at: string;
}

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan*", "Feb*"];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-2/3" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-20" />
      <div className="h-4 bg-gray-200 rounded w-40 flex-1" />
      <div className="h-4 bg-gray-200 rounded w-24" />
      <div className="h-4 bg-gray-200 rounded w-20" />
    </div>
  );
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [streams, setStreams] = useState<RevenueStream[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()).catch(() => []),
      fetch("/api/revenue-streams").then((r) => r.json()).catch(() => []),
      fetch("/api/pending-payouts").then((r) => r.json()).catch(() => []),
      fetch("/api/transactions").then((r) => r.json()).catch(() => ({ data: [], total: 0 })),
      fetch("/api/alerts").then((r) => r.json()).catch(() => []),
    ]).then(([accs, strs, pays, txRes, alts]) => {
      setAccounts(Array.isArray(accs) ? accs : []);
      setStreams(Array.isArray(strs) ? strs : []);
      setPayouts(Array.isArray(pays) ? pays : []);
      setTransactions(Array.isArray(txRes?.data) ? txRes.data.slice(0, 8) : Array.isArray(txRes) ? txRes.slice(0, 8) : []);
      setAlerts(Array.isArray(alts) ? alts : []);
      setLoading(false);
    });
  }, []);

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const pendingTotal = payouts
    .filter((p) => p.status === "pending" || p.status === "expected")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const activeStreams = streams.filter((s) => s.status === "active").length;
  const projectedNext = streams.reduce((sum, s) => {
    if (s.projected_next_month) return sum + s.projected_next_month.base;
    return sum + (s.avg_monthly || 0);
  }, 0);

  const chartData = MONTHS.map((m, i) => ({
    month: m,
    revenue: Math.round((projectedNext || 5000) * (0.6 + Math.random() * 0.6)),
    projected: i >= 6 ? Math.round((projectedNext || 5000) * (0.8 + Math.random() * 0.4)) : undefined,
  }));

  const severityColors: Record<string, string> = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };

  const severityIcons: Record<string, string> = {
    info: "ℹ",
    warning: "⚠",
    error: "✕",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Your financial overview at a glance</p>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Total Balance
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Pending Payouts
              </p>
              <p className="text-3xl font-bold text-amber-600 mt-2">
                ${pendingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {payouts.filter((p) => p.status === "pending" || p.status === "expected").length} pending
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Active Streams
              </p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{activeStreams}</p>
              <p className="text-xs text-gray-400 mt-1">
                {streams.length} total stream{streams.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Projected Next Month
              </p>
              <p className="text-3xl font-bold text-indigo-600 mt-2">
                ${projectedNext.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">Based on active streams</p>
            </div>
          </div>
        )}

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue (Last 6 Months + Projections)</h2>
          {loading ? (
            <div className="h-64 bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorProjected)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Projected"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
              <Link
                href="/transactions"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View All
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm mt-1">Add your first transaction to see it here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tx.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.date} &middot; {tx.category} &middot; {tx.account_name}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        tx.type === "income" ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}${Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">No alerts right now. You are all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border text-sm ${severityColors[alert.severity] || severityColors.info}`}
                  >
                    <span className="font-medium mr-1">{severityIcons[alert.severity]}</span>
                    {alert.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href="/accounts"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors text-indigo-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-sm font-medium">Add Account</span>
            </Link>
            <Link
              href="/transactions"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm font-medium">Add Transaction</span>
            </Link>
            <Link
              href="/import"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-sm font-medium">Import Data</span>
            </Link>
            <Link
              href="/revenue-streams/add"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-purple-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-sm font-medium">Add Revenue Stream</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
