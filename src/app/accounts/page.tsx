"use client";

import { useEffect, useState } from "react";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  institution: string;
  color: string;
}

const ACCOUNT_TYPES = ["checking", "savings", "investment", "cash", "credit_card", "crypto", "other"];

const CURRENCIES = [
  "USD","EUR","GBP","MAD","CAD","AUD","JPY","CHF","CNY","INR","BRL","MXN","SGD","HKD",
  "NOK","SEK","DKK","NZD","ZAR","KRW","TRY","SAR","AED","EGP","NGN","KES","GHS","TND",
  "PKR","BDT","PHP","IDR","THB","VND","MYR","PLN","CZK","HUF","RON","BGN","HRK","RUB",
  "UAH","ILS","QAR","KWD","BHD","OMR","JOD","LBP","COP","CLP","PEN","ARS","TWD",
];

const TYPE_COLORS: Record<string, string> = {
  checking: "bg-blue-100 text-blue-700",
  savings: "bg-emerald-100 text-emerald-700",
  investment: "bg-purple-100 text-purple-700",
  cash: "bg-yellow-100 text-yellow-700",
  credit_card: "bg-red-100 text-red-700",
  crypto: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "checking",
    currency: "USD",
    balance: "",
    institution: "",
    color: COLORS[0],
  });

  const fetchAccounts = () => {
    setLoading(true);
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => {
        setAccounts(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  const resetForm = () => {
    setForm({ name: "", type: "checking", currency: "USD", balance: "", institution: "", color: COLORS[0] });
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (account: Account) => {
    setForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: String(account.balance),
      institution: account.institution || "",
      color: account.color || COLORS[0],
    });
    setEditingId(account.id);
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, balance: parseFloat(form.balance) || 0 };
    if (editingId) {
      await fetch(`/api/accounts/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setShowDialog(false);
    resetForm();
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    fetchAccounts();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
            <p className="text-gray-500 mt-1">Manage your financial accounts</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Account
          </button>
        </div>

        {/* Total Balance Bar */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-6 mb-8 text-white shadow-lg">
          <p className="text-indigo-200 text-sm font-medium uppercase tracking-wide">Total Balance (All Accounts)</p>
          <p className="text-4xl font-bold mt-2">
            ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-indigo-200 text-sm mt-1">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} connected
          </p>
        </div>

        {/* Account Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="text-5xl mb-4">🏦</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No accounts yet</h3>
            <p className="text-gray-500 mb-6">Add your first account to get started tracking your finances.</p>
            <button
              onClick={openAdd}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Add Your First Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow relative"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                  style={{ backgroundColor: account.color || COLORS[0] }}
                />
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                    {account.institution && (
                      <p className="text-sm text-gray-400">{account.institution}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(account)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {account.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  <span className="text-lg font-normal text-gray-400 ml-1">{account.currency}</span>
                </p>
                {account.currency !== "USD" && (
                  <p className="text-sm text-gray-400 mt-1">
                    ≈ ${account.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
                  </p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_COLORS[account.type] || TYPE_COLORS.other}`}>
                    {account.type.replace("_", " ")}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    {account.currency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        {showDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingId ? "Edit Account" : "Add Account"}
                  </h2>
                  <button
                    onClick={() => { setShowDialog(false); resetForm(); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g. Main Checking"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Institution</label>
                  <input
                    type="text"
                    value={form.institution}
                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g. Bank of America"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setShowDialog(false); resetForm(); }}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    {editingId ? "Save Changes" : "Add Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
