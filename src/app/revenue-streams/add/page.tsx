"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REVENUE_STREAM_TYPES, CURRENCIES, formatCurrency } from "@/lib/utils";

const STATUSES = ["active", "paused", "completed", "pipeline"];
const EFFORT_LEVELS = ["low", "medium", "high", "very_high"];
const SCALABILITY_LEVELS = ["none", "low", "medium", "high"];
const STRATEGIC_TAGS = ["core", "growth", "experimental", "passive", "winding_down"];

interface Milestone {
  name: string;
  amount: number;
  dueDate: string;
}

interface FormData {
  // Step 1 - Basics
  name: string;
  type: string;
  status: string;
  currency: string;
  color: string;
  startDate: string;
  endDate: string;
  notes: string;
  // Step 2 - Type-specific
  typeVariables: Record<string, any>;
  // Step 3 - Effort & Strategy
  hoursPerWeek: number;
  effortLevel: string;
  scalability: string;
  strategicTag: string;
}

const TYPE_VARIABLE_FIELDS: Record<string, { key: string; label: string; type: string; options?: string[]; placeholder?: string }[]> = {
  retainer: [
    { key: "monthly_amount", label: "Monthly Amount", type: "number", placeholder: "0.00" },
    { key: "payment_day", label: "Payment Day of Month", type: "number", placeholder: "1-31" },
    { key: "payment_terms", label: "Payment Terms", type: "select", options: ["net_15", "net_30", "net_45", "net_60", "due_on_receipt"] },
    { key: "auto_renew", label: "Auto-Renew", type: "toggle" },
    { key: "rate_increase", label: "Annual Rate Increase (%)", type: "number", placeholder: "0" },
  ],
  rev_share: [
    { key: "commission_rate", label: "Commission Rate (%)", type: "number", placeholder: "0" },
    { key: "revenue_base", label: "Revenue Base", type: "text", placeholder: "e.g., Total gross sales" },
    { key: "payout_delay_days", label: "Payout Delay (days)", type: "number", placeholder: "30" },
    { key: "minimum_guarantee", label: "Minimum Guarantee", type: "number", placeholder: "0.00" },
    { key: "cap", label: "Cap (max payout)", type: "number", placeholder: "No cap" },
  ],
  affiliate: [
    { key: "commission_per_referral", label: "Commission per Referral", type: "number", placeholder: "0.00" },
    { key: "commission_type", label: "Commission Type", type: "select", options: ["one_time", "recurring", "tiered"] },
    { key: "active_referrals", label: "Active Referrals", type: "number", placeholder: "0" },
    { key: "churn_rate", label: "Monthly Churn Rate (%)", type: "number", placeholder: "0" },
    { key: "avg_new_monthly", label: "Avg New Referrals / Month", type: "number", placeholder: "0" },
    { key: "payout_threshold", label: "Payout Threshold", type: "number", placeholder: "0.00" },
  ],
  project: [
    { key: "total_value", label: "Total Project Value", type: "number", placeholder: "0.00" },
    { key: "payment_structure", label: "Payment Structure", type: "select", options: ["upfront", "milestone", "50_50", "on_completion", "custom"] },
    { key: "milestones", label: "Milestones", type: "milestones" },
    { key: "retainer_potential", label: "Retainer Potential After Project", type: "toggle" },
  ],
  consulting: [
    { key: "rate_type", label: "Rate Type", type: "select", options: ["hourly", "daily", "weekly", "monthly"] },
    { key: "rate", label: "Rate Amount", type: "number", placeholder: "0.00" },
    { key: "avg_units_month", label: "Avg Units / Month", type: "number", placeholder: "0" },
    { key: "min_commitment", label: "Min Commitment (units)", type: "number", placeholder: "0" },
    { key: "max_capacity", label: "Max Capacity (units)", type: "number", placeholder: "0" },
    { key: "billing_cycle", label: "Billing Cycle", type: "select", options: ["weekly", "biweekly", "monthly", "on_completion"] },
    { key: "payment_terms", label: "Payment Terms", type: "select", options: ["net_15", "net_30", "net_45", "net_60", "due_on_receipt"] },
  ],
  subscription: [
    { key: "price", label: "Subscription Price", type: "number", placeholder: "0.00" },
    { key: "subscriber_count", label: "Current Subscriber Count", type: "number", placeholder: "0" },
    { key: "growth_rate", label: "Monthly Growth Rate (%)", type: "number", placeholder: "0" },
    { key: "churn_rate", label: "Monthly Churn Rate (%)", type: "number", placeholder: "0" },
    { key: "launch_date", label: "Launch Date", type: "date" },
  ],
  product_sales: [
    { key: "price", label: "Product Price", type: "number", placeholder: "0.00" },
    { key: "avg_units_month", label: "Avg Units Sold / Month", type: "number", placeholder: "0" },
    { key: "refund_rate", label: "Refund Rate (%)", type: "number", placeholder: "0" },
    { key: "profit_margin", label: "Profit Margin (%)", type: "number", placeholder: "0" },
    { key: "sales_channel", label: "Sales Channel", type: "select", options: ["direct", "marketplace", "retail", "wholesale", "mixed"] },
  ],
  ad_revenue: [
    { key: "revenue_model", label: "Revenue Model", type: "select", options: ["cpm", "cpc", "cpa", "flat_rate", "hybrid"] },
    { key: "avg_monthly_revenue", label: "Avg Monthly Revenue", type: "number", placeholder: "0.00" },
    { key: "traffic_count", label: "Monthly Traffic / Impressions", type: "number", placeholder: "0" },
    { key: "rate", label: "Rate (per unit)", type: "number", placeholder: "0.00" },
    { key: "payout_frequency", label: "Payout Frequency", type: "select", options: ["weekly", "biweekly", "monthly", "quarterly", "threshold"] },
  ],
};

export default function AddRevenueStreamPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([{ name: "", amount: 0, dueDate: "" }]);

  const [form, setForm] = useState<FormData>({
    name: "",
    type: "retainer",
    status: "active",
    currency: "USD",
    color: "#3B82F6",
    startDate: "",
    endDate: "",
    notes: "",
    typeVariables: {},
    hoursPerWeek: 0,
    effortLevel: "medium",
    scalability: "medium",
    strategicTag: "core",
  });

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateTypeVar = (key: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      typeVariables: { ...prev.typeVariables, [key]: value },
    }));
  };

  const addMilestone = () => {
    setMilestones((prev) => [...prev, { name: "", amount: 0, dueDate: "" }]);
  };

  const removeMilestone = (idx: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, field: keyof Milestone, value: any) => {
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const canProceed = () => {
    if (step === 1) return form.name.trim() !== "" && form.type !== "";
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...form,
        typeVariables: form.type === "project"
          ? { ...form.typeVariables, milestones }
          : form.typeVariables,
      };
      const res = await fetch("/api/revenue-streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create revenue stream");
      }
      router.push("/revenue-streams");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = REVENUE_STREAM_TYPES.find((t) => t.value === form.type)?.label || form.type;

  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="e.g., Agency Retainer - Acme Corp"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={form.type}
            onChange={(e) => {
              updateField("type", e.target.value);
              updateField("typeVariables", {});
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {REVENUE_STREAM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => updateField("status", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={form.currency}
            onChange={(e) => updateField("currency", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.color}
              onChange={(e) => updateField("color", e.target.value)}
              className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
            />
            <span className="text-sm text-gray-500">{form.color}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => updateField("startDate", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => updateField("endDate", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          placeholder="Any additional notes..."
        />
      </div>
    </div>
  );

  const renderStep2 = () => {
    const fields = TYPE_VARIABLE_FIELDS[form.type] || [];
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500 mb-2">Configure variables specific to <span className="font-semibold text-gray-700">{typeLabel}</span></p>
        {fields.map((field) => {
          if (field.type === "milestones") {
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">{field.label}</label>
                {milestones.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Milestone name"
                      value={m.name}
                      onChange={(e) => updateMilestone(idx, "name", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={m.amount || ""}
                      onChange={(e) => updateMilestone(idx, "amount", parseFloat(e.target.value) || 0)}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="date"
                      value={m.dueDate}
                      onChange={(e) => updateMilestone(idx, "dueDate", e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    {milestones.length > 1 && (
                      <button onClick={() => removeMilestone(idx)} className="text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold">&times;</button>
                    )}
                  </div>
                ))}
                <button onClick={addMilestone} className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-1">+ Add Milestone</button>
              </div>
            );
          }
          if (field.type === "toggle") {
            return (
              <div key={field.key} className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{field.label}</label>
                <button
                  type="button"
                  onClick={() => updateTypeVar(field.key, !form.typeVariables[field.key])}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.typeVariables[field.key] ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.typeVariables[field.key] ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            );
          }
          if (field.type === "select") {
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <select
                  value={form.typeVariables[field.key] || ""}
                  onChange={(e) => updateTypeVar(field.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Select...</option>
                  {field.options?.map((o) => (
                    <option key={o} value={o}>{o.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
            );
          }
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={form.typeVariables[field.key] ?? ""}
                onChange={(e) => updateTypeVar(field.key, field.type === "number" ? (e.target.value === "" ? "" : parseFloat(e.target.value)) : e.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          );
        })}
        {fields.length === 0 && (
          <p className="text-gray-400 text-sm italic">No type-specific variables for this type.</p>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hours per Week</label>
        <input
          type="number"
          value={form.hoursPerWeek || ""}
          onChange={(e) => updateField("hoursPerWeek", parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Effort Level</label>
        <select
          value={form.effortLevel}
          onChange={(e) => updateField("effortLevel", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {EFFORT_LEVELS.map((l) => (
            <option key={l} value={l}>{l.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Scalability</label>
        <select
          value={form.scalability}
          onChange={(e) => updateField("scalability", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {SCALABILITY_LEVELS.map((l) => (
            <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Strategic Tag</label>
        <select
          value={form.strategicTag}
          onChange={(e) => updateField("strategicTag", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {STRATEGIC_TAGS.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Review Summary</h3>
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Name:</span>
            <p className="font-medium text-gray-900">{form.name}</p>
          </div>
          <div>
            <span className="text-gray-500">Type:</span>
            <p className="font-medium text-gray-900">{typeLabel}</p>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <p className="font-medium text-gray-900 capitalize">{form.status}</p>
          </div>
          <div>
            <span className="text-gray-500">Currency:</span>
            <p className="font-medium text-gray-900">{form.currency}</p>
          </div>
          <div>
            <span className="text-gray-500">Color:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: form.color }} />
              <span className="font-medium text-gray-900">{form.color}</span>
            </div>
          </div>
          {form.startDate && (
            <div>
              <span className="text-gray-500">Start Date:</span>
              <p className="font-medium text-gray-900">{form.startDate}</p>
            </div>
          )}
          {form.endDate && (
            <div>
              <span className="text-gray-500">End Date:</span>
              <p className="font-medium text-gray-900">{form.endDate}</p>
            </div>
          )}
        </div>
        {Object.keys(form.typeVariables).length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Type Variables</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(form.typeVariables).map(([k, v]) => (
                <div key={k}>
                  <span className="text-gray-500">{k.replace(/_/g, " ")}:</span>
                  <p className="font-medium text-gray-900">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {form.type === "project" && milestones.some((m) => m.name) && (
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Milestones</p>
            {milestones.filter((m) => m.name).map((m, i) => (
              <div key={i} className="text-sm text-gray-700">
                {m.name} - {formatCurrency(m.amount, form.currency)} {m.dueDate && `(Due: ${m.dueDate})`}
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Effort & Strategy</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Hours/week:</span>
              <p className="font-medium text-gray-900">{form.hoursPerWeek}</p>
            </div>
            <div>
              <span className="text-gray-500">Effort:</span>
              <p className="font-medium text-gray-900 capitalize">{form.effortLevel.replace(/_/g, " ")}</p>
            </div>
            <div>
              <span className="text-gray-500">Scalability:</span>
              <p className="font-medium text-gray-900 capitalize">{form.scalability}</p>
            </div>
            <div>
              <span className="text-gray-500">Strategic tag:</span>
              <p className="font-medium text-gray-900 capitalize">{form.strategicTag.replace(/_/g, " ")}</p>
            </div>
          </div>
        </div>
        {form.notes && (
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-700">{form.notes}</p>
          </div>
        )}
      </div>
    </div>
  );

  const steps = [
    { num: 1, label: "Basics" },
    { num: 2, label: "Type Variables" },
    { num: 3, label: "Effort & Strategy" },
    { num: 4, label: "Review" },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Revenue Stream</h1>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= s.num
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {s.num}
              </div>
              <span className={`ml-2 text-sm font-medium hidden sm:inline ${step >= s.num ? "text-blue-600" : "text-gray-400"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${step > s.num ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => step === 1 ? router.push("/revenue-streams") : setStep(step - 1)}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {step === 1 ? "Cancel" : "Back"}
        </button>
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating..." : "Create Revenue Stream"}
          </button>
        )}
      </div>
    </div>
  );
}
