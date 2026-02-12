"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, CURRENCIES, PRIORITY_LEVELS } from "@/lib/utils";

interface Debt {
  id: string;
  creditorName: string;
  description?: string;
  originalAmount: number;
  remainingBalance: number;
  currency: string;
  interestRate: number;
  interestType: string;
  minimumPayment: number;
  dueDay: number;
  payoffDeadline?: string;
  priority: string;
  isIslamic: boolean;
  autoPay: boolean;
  notes?: string;
  status?: string;
}

const INTEREST_TYPES = ["fixed", "variable", "compound", "simple", "none"];

function SkeletonCard() {
  return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  );
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    creditorName: "",
    description: "",
    originalAmount: "",
    remainingBalance: "",
    currency: "USD",
    interestRate: "",
    interestType: "fixed",
    minimumPayment: "",
    dueDay: "",
    payoffDeadline: "",
    priority: "medium",
    isIslamic: false,
    autoPay: false,
    notes: "",
  });

  const fetchDebts = useCallback(async () => {
    try {
      const res = await fetch("/api/debts");
      if (res.ok) {
        const data = await res.json();
        setDebts(data.debts || data || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const totalOwed = debts.reduce((s, d) => s + d.remainingBalance, 0);
  const totalOriginal = debts.reduce((s, d) => s + d.originalAmount, 0);
  const totalPaid = totalOriginal - totalOwed;
  const onTrackCount = debts.filter((d) => d.status !== "behind" && d.status !== "defaulted").length;

  const calcMonthlyInterest = (d: Debt) => {
    if (d.interestType === "none" || d.isIslamic) return 0;
    return (d.remainingBalance * (d.interestRate / 100)) / 12;
  };

  const progressPercent = (d: Debt) => {
    if (d.originalAmount === 0) return 100;
    return Math.round(((d.originalAmount - d.remainingBalance) / d.originalAmount) * 100);
  };

  const deleteDebt = async (id: string) => {
    if (!confirm("Delete this debt?")) return;
    try {
      const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDebts((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete debt", e);
    }
  };

  const handleAddSubmit = async () => {
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          originalAmount: parseFloat(addForm.originalAmount) || 0,
          remainingBalance: parseFloat(addForm.remainingBalance) || 0,
          interestRate: parseFloat(addForm.interestRate) || 0,
          minimumPayment: parseFloat(addForm.minimumPayment) || 0,
          dueDay: parseInt(addForm.dueDay) || 1,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddForm({ creditorName: "", description: "", originalAmount: "", remainingBalance: "", currency: "USD", interestRate: "", interestType: "fixed", minimumPayment: "", dueDay: "", payoffDeadline: "", priority: "medium", isIslamic: false, autoPay: false, notes: "" });
        fetchDebts();
      }
    } catch (e) {
      console.error("Failed to add debt", e);
    } finally {
      setAddSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Debts</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
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
        <h1 className="text-2xl font-bold text-gray-900">Debts</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          + Add Debt
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Owed</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalOwed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Paid</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Debts Count</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{debts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">On Track</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{onTrackCount} / {debts.length}</p>
        </div>
      </div>

      {/* Debt Cards */}
      {debts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">&#127919;</div>
          <p className="text-gray-500">No debts tracked yet. Add your first debt to start your payoff journey.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map((d) => {
            const pct = progressPercent(d);
            const monthly = calcMonthlyInterest(d);
            const isOnTrack = d.status !== "behind" && d.status !== "defaulted";
            return (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.creditorName}</h3>
                    {d.description && <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={d.priority} />
                    {d.isIslamic && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Islamic</span>}
                    {isOnTrack && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">On Track</span>}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">{formatCurrency(d.originalAmount - d.remainingBalance, d.currency)} paid</span>
                    <span className="font-medium text-gray-900">{formatCurrency(d.remainingBalance, d.currency)} remaining</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{pct}% paid off</span>
                    <span>of {formatCurrency(d.originalAmount, d.currency)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                  {d.interestRate > 0 && !d.isIslamic && (
                    <div>Interest: {d.interestRate}% {d.interestType}</div>
                  )}
                  {monthly > 0 && <div>Monthly interest: ~{formatCurrency(monthly, d.currency)}</div>}
                  <div>Due day: {d.dueDay}th</div>
                  {d.payoffDeadline && <div>Deadline: {new Date(d.payoffDeadline).toLocaleDateString()}</div>}
                  <div>Min payment: {formatCurrency(d.minimumPayment, d.currency)}</div>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => deleteDebt(d.id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
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
              <h2 className="text-lg font-semibold text-gray-900">Add Debt</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Creditor Name *</label>
                <input type="text" value={addForm.creditorName} onChange={(e) => setAddForm({ ...addForm, creditorName: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Chase Bank" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Student loan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Original Amount *</label>
                  <input type="number" value={addForm.originalAmount} onChange={(e) => setAddForm({ ...addForm, originalAmount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Balance *</label>
                  <input type="number" value={addForm.remainingBalance} onChange={(e) => setAddForm({ ...addForm, remainingBalance: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select value={addForm.currency} onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                  <input type="number" value={addForm.interestRate} onChange={(e) => setAddForm({ ...addForm, interestRate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Type</label>
                  <select value={addForm.interestType} onChange={(e) => setAddForm({ ...addForm, interestType: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {INTEREST_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Payment</label>
                  <input type="number" value={addForm.minimumPayment} onChange={(e) => setAddForm({ ...addForm, minimumPayment: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Day</label>
                  <input type="number" min="1" max="31" value={addForm.dueDay} onChange={(e) => setAddForm({ ...addForm, dueDay: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1-31" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payoff Deadline</label>
                  <input type="date" value={addForm.payoffDeadline} onChange={(e) => setAddForm({ ...addForm, payoffDeadline: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={addForm.priority} onChange={(e) => setAddForm({ ...addForm, priority: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {PRIORITY_LEVELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Islamic Finance (No Interest)</label>
                <button type="button" onClick={() => setAddForm({ ...addForm, isIslamic: !addForm.isIslamic })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addForm.isIslamic ? "bg-green-600" : "bg-gray-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addForm.isIslamic ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Auto-Pay</label>
                <button type="button" onClick={() => setAddForm({ ...addForm, autoPay: !addForm.autoPay })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addForm.autoPay ? "bg-blue-600" : "bg-gray-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addForm.autoPay ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleAddSubmit} disabled={addSubmitting || !addForm.creditorName || !addForm.originalAmount} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {addSubmitting ? "Adding..." : "Add Debt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
