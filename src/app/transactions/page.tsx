"use client";

import { useEffect, useState, useCallback } from "react";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  category: string;
  account_id: string;
  account_name: string;
  revenue_stream_id?: string;
  notes?: string;
}

const CATEGORIES = [
  "salary", "freelance", "investment", "transfer", "food", "housing", "transport",
  "utilities", "entertainment", "healthcare", "education", "shopping", "travel",
  "subscription", "business", "other",
];

const TYPES = ["income", "expense", "transfer"];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showDialog, setShowDialog] = useState(false);
  const pageSize = 20;

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    account_id: "",
    type: "",
    category: "",
    date_from: "",
    date_to: "",
  });

  const [form, setForm] = useState({
    account_id: "",
    type: "expense",
    description: "",
    amount: "",
    currency: "USD",
    category: "other",
    date: new Date().toISOString().split("T")[0],
    revenue_stream_id: "",
    notes: "",
  });

  const fetchTransactions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    if (filters.search) params.set("search", filters.search);
    if (filters.account_id) params.set("account_id", filters.account_id);
    if (filters.type) params.set("type", filters.type);
    if (filters.category) params.set("category", filters.category);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);

    fetch(`/api/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setTransactions(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []);
        setTotal(d?.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) || 0 }),
    });
    setShowDialog(false);
    setForm({
      account_id: "",
      type: "expense",
      description: "",
      amount: "",
      currency: "USD",
      category: "other",
      date: new Date().toISOString().split("T")[0],
      revenue_stream_id: "",
      notes: "",
    });
    fetchTransactions();
  };

  const handleAccountChange = (accountId: string) => {
    setForm((prev) => {
      const acct = accounts.find((a) => a.id === accountId);
      return { ...prev, account_id: accountId, currency: acct?.currency || prev.currency };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
            <p className="text-gray-500 mt-1">Track all your income and expenses</p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Transaction
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <select
              value={filters.account_id}
              onChange={(e) => { setFilters({ ...filters, account_id: e.target.value }); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">All Types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <select
              value={filters.category}
              onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => { setFilters({ ...filters, date_from: e.target.value }); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="From"
            />
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => { setFilters({ ...filters, date_to: e.target.value }); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="To"
            />
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded flex-1" />
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-5xl mb-4">💸</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions found</h3>
              <p className="text-gray-500 mb-6">
                {Object.values(filters).some((v) => v)
                  ? "No transactions match your filters. Try adjusting them."
                  : "Add your first transaction to start tracking your finances."}
              </p>
              {!Object.values(filters).some((v) => v) && (
                <button
                  onClick={() => setShowDialog(true)}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Add First Transaction
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Description</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Amount</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Category</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{tx.date}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                          {tx.notes && <p className="text-xs text-gray-400 mt-0.5">{tx.notes}</p>}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <p className={`text-sm font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                            {tx.type === "income" ? "+" : "-"}
                            {Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {tx.currency}
                          </p>
                          {tx.currency !== "USD" && (
                            <p className="text-xs text-gray-400">
                              ≈ ${Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{tx.account_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} transactions
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          page === p
                            ? "bg-indigo-600 text-white"
                            : "border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Add Transaction Dialog */}
        {showDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Add Transaction</h2>
                  <button onClick={() => setShowDialog(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Account</label>
                    <select
                      required
                      value={form.account_id}
                      onChange={(e) => handleAccountChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      <option value="">Select account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      {TYPES.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <input
                    type="text"
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g. Monthly salary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                    <input
                      type="text"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    placeholder="Additional notes..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowDialog(false)}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Add Transaction
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
