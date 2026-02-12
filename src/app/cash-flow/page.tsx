"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CashFlowEvent {
  date: string;
  description: string;
  amount: number;
  type: "incoming" | "outgoing";
  runningBalance: number;
  confidence: string;
  source?: string;
}

interface CashFlowData {
  events: CashFlowEvent[];
  projectionChart: { date: string; confirmed: number; projected: number }[];
  gaps: { startDate: string; endDate: string; shortfall: number; description: string }[];
  monthlyObligations: number;
  currentBalance: number;
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-red-100 text-red-700",
    confirmed: "bg-green-100 text-green-700",
    projected: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[level] || "bg-gray-100 text-gray-600"}`}>
      {level}
    </span>
  );
}

function SkeletonChart() {
  return <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />;
}

function SkeletonRow() {
  return <div className="h-12 bg-gray-50 rounded animate-pulse mb-2" />;
}

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/cash-flow");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Cash Flow</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <SkeletonChart />
        <div className="mt-6 space-y-2">{[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      </div>
    );
  }

  const events = data?.events || [];
  const chartData = data?.projectionChart || [];
  const gaps = data?.gaps || [];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cash Flow</h1>

      {/* Monthly Obligations Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Monthly Obligations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(data?.monthlyObligations || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Current Balance</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(data?.currentBalance || 0)}</p>
        </div>
      </div>

      {/* Gap Alerts */}
      {gaps.length > 0 && (
        <div className="space-y-3 mb-6">
          {gaps.map((gap, idx) => (
            <div key={idx} className="bg-red-50 border-2 border-red-300 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">&#9888;</span>
                <div>
                  <h3 className="font-semibold text-red-800">Cash Flow Gap Detected</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {gap.description || `Shortfall of ${formatCurrency(gap.shortfall)} between ${new Date(gap.startDate).toLocaleDateString()} and ${new Date(gap.endDate).toLocaleDateString()}`}
                  </p>
                  <p className="text-lg font-bold text-red-800 mt-1">Shortfall: {formatCurrency(gap.shortfall)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Balance Projection Chart */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Balance Projection</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#6B7280" }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: any, name: any) => [formatCurrency(Number(value) || 0), name === "confirmed" ? "Confirmed" : "Projected"]}
                labelFormatter={(label: any) => new Date(String(label)).toLocaleDateString()}
              />
              <Legend />
              <Line type="monotone" dataKey="confirmed" stroke="#10B981" strokeWidth={2} dot={false} name="Confirmed" />
              <Line type="monotone" dataKey="projected" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projected" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-6">
          <div className="text-4xl mb-3">&#128202;</div>
          <p className="text-gray-500">No projection data available yet. Add revenue streams and bills to generate cash flow projections.</p>
        </div>
      )}

      {/* Timeline View */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">90-Day Timeline</h2>
        </div>
        {events.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No events in the next 90 days.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((event, idx) => (
              <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500 w-24 flex-shrink-0">
                    {new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{event.description}</p>
                    {event.source && <p className="text-xs text-gray-400">{event.source}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ConfidenceBadge level={event.confidence} />
                  <span className={`text-sm font-semibold w-28 text-right ${event.type === "incoming" ? "text-green-600" : "text-red-600"}`}>
                    {event.type === "incoming" ? "+" : "-"}{formatCurrency(Math.abs(event.amount))}
                  </span>
                  <span className="text-sm text-gray-500 w-28 text-right">{formatCurrency(event.runningBalance)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
