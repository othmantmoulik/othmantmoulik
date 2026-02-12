"use client";

import { useEffect, useState, useCallback } from "react";
import { CURRENCIES } from "@/lib/utils";

interface Settings {
  primaryCurrency: string;
  waterfall: {
    debt: number;
    safety_net: number;
    goals: number;
    invest: number;
    fun: number;
  };
  debtStrategy: "avalanche" | "snowball" | "deadline_first";
  readinessGateThreshold: number;
  investmentGateEnabled: boolean;
}

function SkeletonBlock() {
  return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    primaryCurrency: "USD",
    waterfall: { debt: 30, safety_net: 20, goals: 20, invest: 20, fun: 10 },
    debtStrategy: "avalanche",
    readinessGateThreshold: 3,
    investmentGateEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data && data.primaryCurrency) {
          setSettings(data);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const waterfallTotal = Object.values(settings.waterfall).reduce((s, v) => s + v, 0);

  const updateWaterfall = (key: keyof Settings["waterfall"], value: number) => {
    setSettings((prev) => ({
      ...prev,
      waterfall: { ...prev.waterfall, [key]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm("This will populate your account with demo data. Continue?")) return;
    setSeeding(true);
    setError("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Seeding failed");
      }
      alert("Demo data has been seeded successfully!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        {saved && <span className="text-sm text-green-600 font-medium">Settings saved!</span>}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="space-y-6">
        {/* Primary Currency */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Primary Display Currency</h2>
          <select
            value={settings.primaryCurrency}
            onChange={(e) => { setSettings({ ...settings, primaryCurrency: e.target.value }); setSaved(false); }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.symbol} {c.code} - {c.name}</option>
            ))}
          </select>
        </div>

        {/* Waterfall Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Waterfall Configuration</h2>
          <p className="text-sm text-gray-500 mb-4">Set the percentage allocation for each bucket. Total must equal 100%.</p>

          {waterfallTotal !== 100 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              Total is {waterfallTotal}% -- it must equal 100%.
            </div>
          )}

          <div className="space-y-4">
            {(Object.entries(settings.waterfall) as [keyof Settings["waterfall"], number][]).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 capitalize">{key.replace(/_/g, " ")}</label>
                  <span className="text-sm font-semibold text-gray-900">{value}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => updateWaterfall(key, parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => updateWaterfall(key, parseInt(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className={`text-sm font-bold ${waterfallTotal === 100 ? "text-green-600" : "text-red-600"}`}>{waterfallTotal}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${waterfallTotal === 100 ? "bg-green-500" : waterfallTotal > 100 ? "bg-red-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, waterfallTotal)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Debt Strategy */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Debt Strategy</h2>
          <div className="space-y-3">
            {[
              { value: "avalanche", label: "Avalanche", desc: "Pay highest interest rate first (mathematically optimal)" },
              { value: "snowball", label: "Snowball", desc: "Pay smallest balance first (psychologically motivating)" },
              { value: "deadline_first", label: "Deadline First", desc: "Pay by closest deadline first" },
            ].map((option) => (
              <label key={option.value} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="debtStrategy"
                  value={option.value}
                  checked={settings.debtStrategy === option.value}
                  onChange={() => { setSettings({ ...settings, debtStrategy: option.value as Settings["debtStrategy"] }); setSaved(false); }}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{option.label}</p>
                  <p className="text-xs text-gray-500">{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Gates */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Gate Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Readiness Gate Threshold (months of expenses)</label>
              <input
                type="number"
                min="1"
                max="24"
                value={settings.readinessGateThreshold}
                onChange={(e) => { setSettings({ ...settings, readinessGateThreshold: parseInt(e.target.value) || 1 }); setSaved(false); }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Number of months of expenses required before advancing past the safety net level.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Investment Gate</label>
                <p className="text-xs text-gray-500">Require all debts to be paid before allocating to investments.</p>
              </div>
              <button
                type="button"
                onClick={() => { setSettings({ ...settings, investmentGateEnabled: !settings.investmentGateEnabled }); setSaved(false); }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.investmentGateEnabled ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.investmentGateEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {/* Seed Demo Data */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Demo Data</h2>
          <p className="text-sm text-gray-500 mb-3">Populate your account with sample data to explore the app.</p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {seeding ? "Seeding..." : "Seed Demo Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
