"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, CURRENCIES } from "@/lib/utils";

interface Bill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDay: number;
  scope: "personal" | "business";
  category: string;
  isEssential: boolean;
  isRevenueGenerating?: boolean;
  paymentMethod?: string;
  autoPay: boolean;
  notes?: string;
  paidThisMonth?: boolean;
  paidDate?: string;
}

const CATEGORIES = [
  "housing", "utilities", "insurance", "subscriptions", "internet",
  "phone", "transportation", "food", "health", "education",
  "software", "hosting", "marketing", "payroll", "taxes", "other",
];

function SkeletonCard() {
  return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;
}

function getStatusForBill(bill: Bill): { label: string; color: string } {
  if (bill.paidThisMonth) return { label: "Paid", color: "bg-green-100 text-green-700" };
  const now = new Date();
  const today = now.getDate();
  if (today > bill.dueDay) return { label: "Overdue", color: "bg-red-100 text-red-700" };
  if (today === bill.dueDay) return { label: "Due Today", color: "bg-blue-100 text-blue-700" };
  return { label: "Upcoming", color: "bg-gray-100 text-gray-600" };
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"personal" | "business">("personal");
  const [showAdd, setShowAdd] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "",
    amount: "",
    currency: "USD",
    dueDay: "",
    scope: "personal" as "personal" | "business",
    category: "other",
    isEssential: false,
    isRevenueGenerating: false,
    paymentMethod: "",
    autoPay: false,
    notes: "",
  });

  const fetchBills = useCallback(async () => {
    try {
      const res = await fetch("/api/bills");
      if (res.ok) {
        const data = await res.json();
        setBills(data.bills || data || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const personalBills = bills.filter((b) => b.scope === "personal");
  const businessBills = bills.filter((b) => b.scope === "business");
  const currentBills = activeTab === "personal" ? personalBills : businessBills;

  const totalPersonal = personalBills.reduce((s, b) => s + b.amount, 0);
  const totalBusiness = businessBills.reduce((s, b) => s + b.amount, 0);
  const totalAll = totalPersonal + totalBusiness;
  const paidCount = bills.filter((b) => b.paidThisMonth).length;
  const unpaidCount = bills.length - paidCount;
  const completionPct = bills.length > 0 ? Math.round((paidCount / bills.length) * 100) : 0;

  const markPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidThisMonth: true, paidDate: new Date().toISOString().split("T")[0] }),
      });
      if (res.ok) {
        setBills((prev) => prev.map((b) => b.id === id ? { ...b, paidThisMonth: true, paidDate: new Date().toISOString().split("T")[0] } : b));
      }
    } catch (e) {
      console.error("Failed to mark paid", e);
    }
  };

  const handleAddSubmit = async () => {
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          amount: parseFloat(addForm.amount) || 0,
          dueDay: parseInt(addForm.dueDay) || 1,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddForm({ name: "", amount: "", currency: "USD", dueDay: "", scope: "personal", category: "other", isEssential: false, isRevenueGenerating: false, paymentMethod: "", autoPay: false, notes: "" });
        fetchBills();
      }
    } catch (e) {
      console.error("Failed to add bill", e);
    } finally {
      setAddSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bills</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
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
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          + Add Bill
        </button>
      </div>

      {/* Summary Row */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Personal</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalPersonal)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Business</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalBusiness)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalAll)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Paid / Unpaid</p>
            <p className="text-lg font-bold text-gray-900">{paidCount} <span className="text-gray-400">/</span> {unpaidCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Completion</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">{completionPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("personal")}
          className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "personal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Personal ({personalBills.length})
        </button>
        <button
          onClick={() => setActiveTab("business")}
          className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "business" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Business ({businessBills.length})
        </button>
      </div>

      {/* Bill Cards */}
      {currentBills.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">&#128221;</div>
          <p className="text-gray-500">No {activeTab} bills yet. Add your first bill to track monthly payments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentBills.map((bill) => {
            const status = getStatusForBill(bill);
            return (
              <div key={bill.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{bill.name}</h3>
                      {bill.isEssential && <span className="text-xs text-red-500 font-medium">Essential</span>}
                    </div>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{bill.category.replace(/_/g, " ")}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(bill.amount, bill.currency)}</p>
                  <p className="text-sm text-gray-500">Due: {bill.dueDay}{bill.dueDay === 1 ? "st" : bill.dueDay === 2 ? "nd" : bill.dueDay === 3 ? "rd" : "th"}</p>
                </div>
                {!bill.paidThisMonth && (
                  <button
                    onClick={() => markPaid(bill.id)}
                    className="w-full text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 py-2 rounded-lg transition-colors"
                  >
                    Mark Paid
                  </button>
                )}
                {bill.paidThisMonth && (
                  <div className="text-center text-sm text-green-600 font-medium py-2">Paid {bill.paidDate ? `on ${bill.paidDate}` : ""}</div>
                )}
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
              <h2 className="text-lg font-semibold text-gray-900">Add Bill</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Netflix" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input type="number" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Day *</label>
                  <input type="number" min="1" max="31" value={addForm.dueDay} onChange={(e) => setAddForm({ ...addForm, dueDay: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1-31" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select value={addForm.scope} onChange={(e) => setAddForm({ ...addForm, scope: e.target.value as "personal" | "business" })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Essential</label>
                <button type="button" onClick={() => setAddForm({ ...addForm, isEssential: !addForm.isEssential })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addForm.isEssential ? "bg-red-500" : "bg-gray-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addForm.isEssential ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {addForm.scope === "business" && (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Revenue Generating</label>
                  <button type="button" onClick={() => setAddForm({ ...addForm, isRevenueGenerating: !addForm.isRevenueGenerating })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addForm.isRevenueGenerating ? "bg-green-600" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addForm.isRevenueGenerating ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <input type="text" value={addForm.paymentMethod} onChange={(e) => setAddForm({ ...addForm, paymentMethod: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Credit Card ending 4242" />
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
              <button onClick={handleAddSubmit} disabled={addSubmitting || !addForm.name || !addForm.amount} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {addSubmitting ? "Adding..." : "Add Bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
