"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, CURRENCIES, PRIORITY_LEVELS } from "@/lib/utils";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currency: string;
  savedAmount: number;
  monthlyContribution: number;
  targetDate: string;
  priority: string;
  bucket: string;
  needVsWant: "need" | "want";
  status: string;
}

const BUCKETS = [
  { value: "safety_net", label: "Safety Net" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "house_fund", label: "House Fund" },
  { value: "investment", label: "Investment" },
  { value: "fun_money", label: "Fun Money" },
  { value: "custom", label: "Custom" },
];

const GOAL_STATUSES = ["active", "paused", "completed", "abandoned"];

const BUCKET_COLORS: Record<string, string> = {
  safety_net: "bg-amber-100 text-amber-700",
  debt_payoff: "bg-red-100 text-red-700",
  house_fund: "bg-blue-100 text-blue-700",
  investment: "bg-purple-100 text-purple-700",
  fun_money: "bg-pink-100 text-pink-700",
  custom: "bg-gray-100 text-gray-700",
};

function SkeletonCard() {
  return <div className="h-52 bg-gray-100 rounded-xl animate-pulse" />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "",
    targetAmount: "",
    currency: "USD",
    savedAmount: "",
    monthlyContribution: "",
    targetDate: "",
    priority: "medium",
    bucket: "safety_net",
    needVsWant: "need" as "need" | "want",
    status: "active",
  });

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || data || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0);
  const totalTargets = goals.reduce((s, g) => s + g.targetAmount, 0);

  const isOnTrack = (g: Goal) => {
    const remaining = g.targetAmount - g.savedAmount;
    if (remaining <= 0) return true;
    const target = new Date(g.targetDate);
    const now = new Date();
    const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
    const needed = remaining / monthsLeft;
    return g.monthlyContribution >= needed;
  };

  const onTrackCount = goals.filter(isOnTrack).length;

  const handleAddSubmit = async () => {
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          targetAmount: parseFloat(addForm.targetAmount) || 0,
          savedAmount: parseFloat(addForm.savedAmount) || 0,
          monthlyContribution: parseFloat(addForm.monthlyContribution) || 0,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddForm({ name: "", targetAmount: "", currency: "USD", savedAmount: "", monthlyContribution: "", targetDate: "", priority: "medium", bucket: "safety_net", needVsWant: "need", status: "active" });
        fetchGoals();
      }
    } catch (e) {
      console.error("Failed to add goal", e);
    } finally {
      setAddSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Goals</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
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

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          + Add Goal
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Saved</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalSaved)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Targets</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalTargets)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">On Track</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{onTrackCount} / {goals.length}</p>
        </div>
      </div>

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">&#127919;</div>
          <p className="text-gray-500">No goals yet. Set your first financial goal to start tracking progress.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
            const onTrack = isOnTrack(g);
            const bucketLabel = BUCKETS.find((b) => b.value === g.bucket)?.label || g.bucket;
            return (
              <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{g.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BUCKET_COLORS[g.bucket] || BUCKET_COLORS.custom}`}>
                        {bucketLabel}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${g.needVsWant === "need" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"}`}>
                        {g.needVsWant === "need" ? "Need" : "Want"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={g.priority} />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${onTrack ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      {onTrack ? "On Track" : "Behind"}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900">{formatCurrency(g.savedAmount, g.currency)}</span>
                    <span className="text-gray-500">of {formatCurrency(g.targetAmount, g.currency)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{pct}% complete</span>
                    <span>{formatCurrency(g.targetAmount - g.savedAmount, g.currency)} remaining</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Monthly: {formatCurrency(g.monthlyContribution, g.currency)}</div>
                  <div>Target: {new Date(g.targetDate).toLocaleDateString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Add Goal</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Emergency Fund" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount *</label>
                  <input type="number" value={addForm.targetAmount} onChange={(e) => setAddForm({ ...addForm, targetAmount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select value={addForm.currency} onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saved Amount</label>
                  <input type="number" value={addForm.savedAmount} onChange={(e) => setAddForm({ ...addForm, savedAmount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Contribution</label>
                  <input type="number" value={addForm.monthlyContribution} onChange={(e) => setAddForm({ ...addForm, monthlyContribution: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                <input type="date" value={addForm.targetDate} onChange={(e) => setAddForm({ ...addForm, targetDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={addForm.priority} onChange={(e) => setAddForm({ ...addForm, priority: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {PRIORITY_LEVELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bucket</label>
                  <select value={addForm.bucket} onChange={(e) => setAddForm({ ...addForm, bucket: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Need vs Want</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="needVsWant" value="need" checked={addForm.needVsWant === "need"} onChange={() => setAddForm({ ...addForm, needVsWant: "need" })} className="text-blue-600" />
                    <span className="text-sm">Need</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="needVsWant" value="want" checked={addForm.needVsWant === "want"} onChange={() => setAddForm({ ...addForm, needVsWant: "want" })} className="text-blue-600" />
                    <span className="text-sm">Want</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {GOAL_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleAddSubmit} disabled={addSubmitting || !addForm.name || !addForm.targetAmount} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {addSubmitting ? "Adding..." : "Add Goal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
