"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, REVENUE_STREAM_TYPES } from "@/lib/utils";

interface AllocationLineItem {
  target: string;
  amount: number;
  level: number;
  note?: string;
  type?: string;
}

interface AllocationResult {
  lineItems: AllocationLineItem[];
  totalAllocated: number;
  remainingAfter: number;
  incomeAmount: number;
}

interface WaterfallConfig {
  levels: { level: number; name: string; percentage: number; targets: string[] }[];
}

interface WhatIfResult {
  streamName: string;
  currentMonthly: number;
  impact: {
    withStream: AllocationResult;
    withoutStream: AllocationResult;
    difference: number;
  };
}

interface RevenueStream {
  id: string;
  name: string;
  type: string;
  avg_monthly: number;
}

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  2: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  3: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  4: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  5: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  6: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  7: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  8: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

function SkeletonBlock() {
  return <div className="h-16 bg-gray-100 rounded-lg animate-pulse mb-2" />;
}

export default function AllocationPage() {
  const [config, setConfig] = useState<WaterfallConfig | null>(null);
  const [allocation, setAllocation] = useState<AllocationResult | null>(null);
  const [streams, setStreams] = useState<RevenueStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [incomeInput, setIncomeInput] = useState("");
  const [calculating, setCalculating] = useState(false);

  // What-If
  const [selectedStream, setSelectedStream] = useState("");
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const [analyzingWhatIf, setAnalyzingWhatIf] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, allocRes, streamsRes] = await Promise.all([
        fetch("/api/allocation/config"),
        fetch("/api/allocation"),
        fetch("/api/revenue-streams"),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config || data || null);
      }
      if (allocRes.ok) {
        const data = await allocRes.json();
        setAllocation(data.allocation || data || null);
      }
      if (streamsRes.ok) {
        const data = await streamsRes.json();
        setStreams(data.streams || data || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const calculateAllocation = async () => {
    const amount = parseFloat(incomeInput);
    if (!amount || amount <= 0) return;
    setCalculating(true);
    try {
      const res = await fetch("/api/allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incomeAmount: amount }),
      });
      if (res.ok) {
        const data = await res.json();
        setAllocation(data.allocation || data);
      }
    } catch (e) {
      console.error("Failed to calculate allocation", e);
    } finally {
      setCalculating(false);
    }
  };

  const analyzeWhatIf = async () => {
    if (!selectedStream) return;
    setAnalyzingWhatIf(true);
    try {
      const res = await fetch("/api/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueStreamId: selectedStream }),
      });
      if (res.ok) {
        const data = await res.json();
        setWhatIfResult(data);
      }
    } catch (e) {
      console.error("Failed to analyze what-if", e);
    } finally {
      setAnalyzingWhatIf(false);
    }
  };

  const getLevelColor = (level: number) => LEVEL_COLORS[level] || LEVEL_COLORS[8];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Allocation Waterfall</h1>
        <div className="h-14 bg-gray-100 rounded-xl animate-pulse mb-6" />
        {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      </div>
    );
  }

  // Group by level
  const grouped: Record<number, AllocationLineItem[]> = {};
  if (allocation?.lineItems) {
    allocation.lineItems.forEach((item) => {
      if (!grouped[item.level]) grouped[item.level] = [];
      grouped[item.level].push(item);
    });
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Allocation Waterfall</h1>

      {/* Income Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Enter income amount to allocate</label>
        <div className="flex gap-3">
          <input
            type="number"
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g., 5000"
          />
          <button
            onClick={calculateAllocation}
            disabled={calculating || !incomeInput}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {calculating ? "Calculating..." : "Calculate Allocation"}
          </button>
        </div>
      </div>

      {/* Allocation Report */}
      {allocation && allocation.lineItems && allocation.lineItems.length > 0 ? (
        <div className="space-y-3 mb-8">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, items]) => {
              const colors = getLevelColor(Number(level));
              const levelTotal = items.reduce((s, i) => s + i.amount, 0);
              return (
                <div key={level} className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${colors.text} bg-white border ${colors.border}`}>
                        L{level}
                      </span>
                      <span className={`text-sm font-semibold ${colors.text}`}>Level {level}</span>
                    </div>
                    <span className={`text-sm font-bold ${colors.text}`}>{formatCurrency(levelTotal)}</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm px-2 py-1">
                        <span className="text-gray-700">{item.target}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                          {item.note && <span className="text-xs text-gray-400">{item.note}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Income</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(allocation.incomeAmount || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Allocated</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(allocation.totalAllocated || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Remaining</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(allocation.remainingAfter || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-8">
          <div className="text-4xl mb-3">&#128200;</div>
          <p className="text-gray-500">Enter an income amount above and click "Calculate Allocation" to see your waterfall breakdown.</p>
        </div>
      )}

      {/* What-If Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">What-If Analysis</h2>
        <div className="flex gap-3 mb-4">
          <select
            value={selectedStream}
            onChange={(e) => setSelectedStream(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Select a revenue stream...</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={analyzeWhatIf}
            disabled={analyzingWhatIf || !selectedStream}
            className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {analyzingWhatIf ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {whatIfResult && (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h3 className="font-semibold text-purple-800 mb-2">
              Impact of losing: {whatIfResult.streamName}
            </h3>
            <p className="text-sm text-purple-700 mb-2">
              Current monthly: {formatCurrency(whatIfResult.currentMonthly)}
            </p>
            {whatIfResult.impact && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-purple-600 font-medium">With Stream</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(whatIfResult.impact.withStream?.totalAllocated || 0)}</p>
                </div>
                <div>
                  <p className="text-purple-600 font-medium">Without Stream</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(whatIfResult.impact.withoutStream?.totalAllocated || 0)}</p>
                </div>
              </div>
            )}
            {whatIfResult.impact?.difference !== undefined && (
              <p className={`mt-2 text-sm font-semibold ${whatIfResult.impact.difference < 0 ? "text-red-600" : "text-green-600"}`}>
                Difference: {formatCurrency(whatIfResult.impact.difference)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
