"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, PAYOUT_STATUSES, CURRENCIES } from "@/lib/utils";

interface Payout {
  id: string;
  revenueStreamId: string;
  streamName: string;
  amount: number;
  currency: string;
  expectedDate: string;
  receivedDate?: string;
  status: string;
  confidence: string;
  sourceDetail?: string;
  periodCovered?: string;
  notes?: string;
}

interface RevenueStream {
  id: string;
  name: string;
}

const CONFIDENCE_LEVELS = ["high", "medium", "low"];

function StatusBadge({ status }: { status: string }) {
  const ps = PAYOUT_STATUSES.find((p) => p.value === status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ps?.color || "bg-gray-100 text-gray-800"}`}>
      {ps?.label || status}
    </span>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: "text-green-700 bg-green-50",
    medium: "text-yellow-700 bg-yellow-50",
    low: "text-red-700 bg-red-50",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[level] || "text-gray-600 bg-gray-50"}`}>
      {level}
    </span>
  );
}

function SkeletonCard() {
  return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
}

function SkeletonRow() {
  return <div className="h-12 bg-gray-50 rounded animate-pulse mb-2" />;
}

export default function PendingPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [streams, setStreams] = useState<RevenueStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStream, setFilterStream] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Add form
  const [addForm, setAddForm] = useState({
    revenueStreamId: "",
    amount: "",
    currency: "USD",
    expectedDate: "",
    periodCovered: "",
    confidence: "medium",
    sourceDetail: "",
    notes: "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [payoutsRes, streamsRes] = await Promise.all([
        fetch("/api/pending-payouts"),
        fetch("/api/revenue-streams"),
      ]);
      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setPayouts(data.payouts || data || []);
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

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthPayouts = payouts.filter((p) => {
    const d = new Date(p.expectedDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalExpected = thisMonthPayouts.reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payouts.filter((p) => p.status === "late").reduce((s, p) => s + p.amount, 0);
  const totalReceived = thisMonthPayouts.filter((p) => p.status === "received").reduce((s, p) => s + p.amount, 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  const filtered = payouts.filter((p) => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterStream && p.revenueStreamId !== filterStream) return false;
    if (filterDateFrom && p.expectedDate < filterDateFrom) return false;
    if (filterDateTo && p.expectedDate > filterDateTo) return false;
    return true;
  });

  const getDaysUntil = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const markAsReceived = async (id: string) => {
    try {
      const res = await fetch(`/api/pending-payouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "received", receivedDate: new Date().toISOString().split("T")[0] }),
      });
      if (res.ok) {
        setPayouts((prev) => prev.map((p) => p.id === id ? { ...p, status: "received", receivedDate: new Date().toISOString().split("T")[0] } : p));
      }
    } catch (e) {
      console.error("Failed to mark as received", e);
    }
  };

  const handleAddSubmit = async () => {
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/pending-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          amount: parseFloat(addForm.amount) || 0,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddForm({ revenueStreamId: "", amount: "", currency: "USD", expectedDate: "", periodCovered: "", confidence: "medium", sourceDetail: "", notes: "" });
        fetchData();
      }
    } catch (e) {
      console.error("Failed to add payout", e);
    } finally {
      setAddSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Pending Payouts</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Pending Payouts</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          + Add Payout
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Expected This Month</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalExpected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-5">
          <p className="text-sm text-red-600">Total Overdue</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalOverdue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-5">
          <p className="text-sm text-green-600">Received This Month</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Collection Rate</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{collectionRate}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Statuses</option>
          {PAYOUT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterStream} onChange={(e) => setFilterStream(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Streams</option>
          {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="From" />
        <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="To" />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">&#128176;</div>
          <p className="text-gray-500">No payouts found. Add your first expected payout to start tracking.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stream</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Expected Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Confidence</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Days</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const days = getDaysUntil(p.expectedDate);
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.streamName}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.amount, p.currency)}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(p.expectedDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3"><ConfidenceBadge level={p.confidence} /></td>
                      <td className={`px-4 py-3 text-right font-medium ${days < 0 ? "text-red-600" : "text-gray-600"}`}>
                        {p.status === "received" ? "--" : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{p.sourceDetail || "--"}</td>
                      <td className="px-4 py-3 text-right">
                        {p.status !== "received" && (
                          <button
                            onClick={() => markAsReceived(p.id)}
                            className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Mark Received
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Add Payout</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Stream</label>
                <select value={addForm.revenueStreamId} onChange={(e) => setAddForm({ ...addForm, revenueStreamId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Select stream...</option>
                  {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input type="number" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select value={addForm.currency} onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
                <input type="date" value={addForm.expectedDate} onChange={(e) => setAddForm({ ...addForm, expectedDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period Covered</label>
                <input type="text" value={addForm.periodCovered} onChange={(e) => setAddForm({ ...addForm, periodCovered: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., January 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confidence</label>
                <select value={addForm.confidence} onChange={(e) => setAddForm({ ...addForm, confidence: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Detail</label>
                <input type="text" value={addForm.sourceDetail} onChange={(e) => setAddForm({ ...addForm, sourceDetail: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Invoice #123" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleAddSubmit} disabled={addSubmitting || !addForm.revenueStreamId || !addForm.amount} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {addSubmitting ? "Adding..." : "Add Payout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
