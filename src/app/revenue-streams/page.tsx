"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RevenueStream {
  id: string;
  name: string;
  type: string;
  status: string;
  client?: string;
  currency: string;
  color?: string;
  commission_rate?: number;
  commission_type?: string;
  last_payout_date?: string;
  last_payout_amount?: number;
  avg_monthly: number;
  trend?: "up" | "down" | "stable";
  pending_amount?: number;
  projected_next_month?: { base: number; optimistic: number; pessimistic: number };
}

const TYPE_COLORS: Record<string, string> = {
  retainer: "bg-blue-100 text-blue-700",
  rev_share: "bg-purple-100 text-purple-700",
  affiliate: "bg-pink-100 text-pink-700",
  project: "bg-orange-100 text-orange-700",
  consulting: "bg-teal-100 text-teal-700",
  subscription: "bg-indigo-100 text-indigo-700",
  product_sales: "bg-yellow-100 text-yellow-700",
  ad_revenue: "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  pipeline: "bg-blue-100 text-blue-700",
};

const TREND_ICONS: Record<string, { icon: string; color: string }> = {
  up: { icon: "↑", color: "text-emerald-600" },
  down: { icon: "↓", color: "text-red-500" },
  stable: { icon: "→", color: "text-gray-400" },
};

export default function RevenueStreamsPage() {
  const [streams, setStreams] = useState<RevenueStream[]>([]);
  const [payouts, setPayouts] = useState<{ amount: number; status: string; currency: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/revenue-streams").then((r) => r.json()).catch(() => []),
      fetch("/api/pending-payouts").then((r) => r.json()).catch(() => []),
    ]).then(([strs, pays]) => {
      setStreams(Array.isArray(strs) ? strs : []);
      setPayouts(Array.isArray(pays) ? pays : []);
      setLoading(false);
    });
  }, []);

  const activeStreams = streams.filter((s) => s.status === "active");
  const thisMonthReceived = payouts
    .filter((p) => p.status === "received")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingTotal = payouts
    .filter((p) => p.status === "pending" || p.status === "expected")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const projectedBase = activeStreams.reduce(
    (sum, s) => sum + (s.projected_next_month?.base || s.avg_monthly || 0),
    0
  );
  const projectedOpt = activeStreams.reduce(
    (sum, s) => sum + (s.projected_next_month?.optimistic || s.avg_monthly * 1.2 || 0),
    0
  );
  const projectedPess = activeStreams.reduce(
    (sum, s) => sum + (s.projected_next_month?.pessimistic || s.avg_monthly * 0.8 || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue Streams</h1>
            <p className="text-gray-500 mt-1">Manage and track your income sources</p>
          </div>
          <Link
            href="/revenue-streams/add"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Revenue Stream
          </Link>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">This Month Received</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">
                ${thisMonthReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending Payouts</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">
                ${pendingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Streams</p>
              <p className="text-3xl font-bold text-indigo-600 mt-2">{activeStreams.length}</p>
              <p className="text-xs text-gray-400 mt-1">{streams.length} total</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Projected Next Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${projectedBase.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </p>
              <div className="flex gap-2 mt-1 text-xs">
                <span className="text-emerald-600">${projectedOpt.toLocaleString()} opt</span>
                <span className="text-gray-300">|</span>
                <span className="text-red-500">${projectedPess.toLocaleString()} pess</span>
              </div>
            </div>
          </div>
        )}

        {/* Stream Cards */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No revenue streams yet</h3>
            <p className="text-gray-500 mb-6">
              Add your first revenue stream to start tracking your income sources.
            </p>
            <Link
              href="/revenue-streams/add"
              className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Add Your First Stream
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {streams.map((stream) => {
              const trend = TREND_ICONS[stream.trend || "stable"];
              return (
                <div
                  key={stream.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow relative"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                    style={{ backgroundColor: stream.color || "#6366f1" }}
                  />
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{stream.name}</h3>
                      {stream.client && (
                        <p className="text-sm text-gray-400">{stream.client}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_COLORS[stream.type] || "bg-gray-100 text-gray-600"}`}>
                        {stream.type.replace("_", " ")}
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[stream.status] || STATUS_COLORS.active}`}>
                        {stream.status}
                      </span>
                    </div>
                  </div>

                  {/* Commission */}
                  {stream.commission_rate && (
                    <p className="text-sm text-gray-500 mb-3">
                      Commission: {stream.commission_rate}% ({stream.commission_type || "revenue"})
                    </p>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Last Payout</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {stream.last_payout_amount
                          ? `$${stream.last_payout_amount.toLocaleString()}`
                          : "---"}
                      </p>
                      {stream.last_payout_date && (
                        <p className="text-xs text-gray-400">{stream.last_payout_date}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Avg Monthly</p>
                      <p className="text-sm font-semibold text-gray-900">
                        ${(stream.avg_monthly || 0).toLocaleString()}
                      </p>
                      <span className={`text-xs font-medium ${trend.color}`}>
                        {trend.icon} {stream.trend || "stable"}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Pending</p>
                      <p className="text-sm font-semibold text-amber-600">
                        ${(stream.pending_amount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Sparkline Placeholder */}
                  <div className="h-8 bg-gray-50 rounded-lg mb-4 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-5">
                      {[3, 5, 4, 7, 6, 8, 7, 9, 8, 10, 9, 11].map((h, i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-indigo-300 rounded-t"
                          style={{ height: `${h * 2}px` }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Projected */}
                  {stream.projected_next_month && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-400 uppercase mb-1">Next Month Projection</p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-lg font-bold text-gray-900">
                          ${stream.projected_next_month.base.toLocaleString()}
                        </span>
                        <span className="text-xs text-emerald-600">
                          ${stream.projected_next_month.optimistic.toLocaleString()} opt
                        </span>
                        <span className="text-xs text-red-500">
                          ${stream.projected_next_month.pessimistic.toLocaleString()} pess
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                      View Details
                    </button>
                    <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                      Log Payout
                    </button>
                    <button className="text-sm font-medium text-gray-600 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
