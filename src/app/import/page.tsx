"use client";

import { useState, useRef } from "react";
import { CURRENCIES } from "@/lib/utils";

interface PreviewRow {
  date?: string;
  description?: string;
  amount?: number;
  debit?: number;
  credit?: number;
  balance?: number;
  category?: string;
  currency?: string;
  isDuplicate?: boolean;
  raw: Record<string, string>;
}

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  sheets?: string[];
  selectedSheet?: string;
  fileType: "csv" | "xlsx" | "xls" | "pdf";
  fileName: string;
}

const COLUMN_TARGETS = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
  { key: "balance", label: "Balance" },
  { key: "category", label: "Category" },
  { key: "currency", label: "Currency" },
];

const FILE_TYPE_ICONS: Record<string, string> = {
  xlsx: "\u{1F4CA}",
  xls: "\u{1F4CA}",
  csv: "\u{1F4CB}",
  pdf: "\u{1F4C4}",
};

export default function ImportPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [accountId, setAccountId] = useState("");
  const [currencyOverride, setCurrencyOverride] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; imported: number; duplicates: number } | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getFileType = (name: string): string => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext;
  };

  const handleFile = (f: File) => {
    const ext = getFileType(f.name);
    if (!["csv", "xlsx", "xls", "pdf"].includes(ext)) {
      setError("Unsupported file type. Please use CSV, XLSX, XLS, or PDF.");
      return;
    }
    setFile(f);
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      setParsedData(data);

      // Fetch accounts
      try {
        const accRes = await fetch("/api/accounts");
        if (accRes.ok) {
          const accData = await accRes.json();
          setAccounts(accData.accounts || accData || []);
        }
      } catch (_e) {}

      const ext = getFileType(file.name);
      if ((ext === "xlsx" || ext === "xls") && data.sheets && data.sheets.length > 1) {
        setStep(2);
      } else {
        // Auto-detect column mapping
        if (data.headers) {
          autoMapColumns(data.headers);
        }
        setStep(3);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const selectSheet = async () => {
    if (!selectedSheet || !parsedData) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file!);
      formData.append("sheet", selectedSheet);
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setParsedData(data);
        if (data.headers) {
          autoMapColumns(data.headers);
        }
        setStep(3);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const autoMapColumns = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();
      if (lower.includes("date") && !mapping.date) mapping.date = h;
      else if ((lower.includes("desc") || lower.includes("narration") || lower.includes("details") || lower.includes("memo")) && !mapping.description) mapping.description = h;
      else if (lower === "amount" && !mapping.amount) mapping.amount = h;
      else if (lower.includes("debit") && !mapping.debit) mapping.debit = h;
      else if (lower.includes("credit") && !mapping.credit) mapping.credit = h;
      else if (lower.includes("balance") && !mapping.balance) mapping.balance = h;
      else if (lower.includes("categor") && !mapping.category) mapping.category = h;
      else if (lower.includes("currenc") && !mapping.currency) mapping.currency = h;
    });
    setColumnMapping(mapping);
  };

  const generatePreview = () => {
    if (!parsedData) return;
    const preview: PreviewRow[] = parsedData.rows.slice(0, 10).map((row) => ({
      date: columnMapping.date ? row[columnMapping.date] : undefined,
      description: columnMapping.description ? row[columnMapping.description] : undefined,
      amount: columnMapping.amount ? parseFloat(row[columnMapping.amount]) || undefined : undefined,
      debit: columnMapping.debit ? parseFloat(row[columnMapping.debit]) || undefined : undefined,
      credit: columnMapping.credit ? parseFloat(row[columnMapping.credit]) || undefined : undefined,
      balance: columnMapping.balance ? parseFloat(row[columnMapping.balance]) || undefined : undefined,
      category: columnMapping.category ? row[columnMapping.category] : undefined,
      currency: columnMapping.currency ? row[columnMapping.currency] : undefined,
      isDuplicate: false,
      raw: row,
    }));
    setPreviewRows(preview);
    setStep(4);
  };

  const confirmImport = async () => {
    setConfirming(true);
    setError("");
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapping: columnMapping,
          accountId,
          currencyOverride: currencyOverride || undefined,
          fileName: parsedData?.fileName,
          rows: parsedData?.rows,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }
      const result = await res.json();
      setImportResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setParsedData(null);
    setSelectedSheet("");
    setColumnMapping({});
    setAccountId("");
    setCurrencyOverride("");
    setPreviewRows([]);
    setImportResult(null);
    setError("");
  };

  const fileIcon = file ? (FILE_TYPE_ICONS[getFileType(file.name)] || "\u{1F4C4}") : "";

  const steps = [
    { num: 1, label: "Upload File" },
    { num: 2, label: "Sheet Selection" },
    { num: 3, label: "Column Mapping" },
    { num: 4, label: "Preview & Confirm" },
  ];

  if (importResult) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Complete</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-5xl mb-4">&#9989;</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Successful</h2>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{importResult.total}</p>
              <p className="text-xs text-gray-500">Total Rows</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
              <p className="text-xs text-gray-500">Imported</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-yellow-600">{importResult.duplicates}</p>
              <p className="text-xs text-gray-500">Duplicates</p>
            </div>
          </div>
          <button onClick={reset} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Import Another File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Transactions</h1>

      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= s.num ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                {s.num}
              </div>
              <span className={`ml-2 text-sm font-medium hidden sm:inline ${step >= s.num ? "text-blue-600" : "text-gray-400"}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${step > s.num ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            {file ? (
              <div>
                <div className="text-5xl mb-3">{fileIcon}</div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-sm text-red-500 hover:text-red-700 mt-2 font-medium">
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-3">&#128228;</div>
                <p className="font-medium text-gray-900">Drag & drop your file here</p>
                <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-3">Supports CSV, XLSX, XLS, PDF</p>
              </div>
            )}
          </div>
          {file && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={uploadFile}
                disabled={uploading}
                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? "Uploading..." : "Upload & Parse"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Sheet Selection */}
      {step === 2 && parsedData?.sheets && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Sheet</h2>
          <p className="text-sm text-gray-500 mb-4">This Excel file contains multiple sheets. Select the one with your transactions.</p>
          <select
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-4"
          >
            <option value="">Select a sheet...</option>
            {parsedData.sheets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Back</button>
            <button onClick={selectSheet} disabled={!selectedSheet || uploading} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              {uploading ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === 3 && parsedData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Map Columns</h2>
          <p className="text-sm text-gray-500 mb-4">Map your file columns to the transaction fields. We've auto-detected what we can.</p>
          <div className="space-y-3 mb-6">
            {COLUMN_TARGETS.map((target) => (
              <div key={target.key} className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-28 flex-shrink-0">{target.label}</label>
                <select
                  value={columnMapping[target.key] || ""}
                  onChange={(e) => setColumnMapping({ ...columnMapping, [target.key]: e.target.value })}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Skip --</option>
                  {parsedData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Select account...</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency Override</label>
              <select value={currencyOverride} onChange={(e) => setCurrencyOverride(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Auto-detect</option>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(parsedData.sheets && parsedData.sheets.length > 1 ? 2 : 1)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Back</button>
            <button onClick={generatePreview} disabled={!columnMapping.date && !columnMapping.amount && !columnMapping.debit} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Preview & Confirm */}
      {step === 4 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview & Confirm</h2>

          {/* Import summary */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4 text-sm text-blue-700">
            <p><strong>{parsedData?.rows.length || 0}</strong> total rows detected. Showing first 10 below.</p>
            {previewRows.filter((r) => r.isDuplicate).length > 0 && (
              <p className="mt-1 text-yellow-700"><strong>{previewRows.filter((r) => r.isDuplicate).length}</strong> potential duplicates detected.</p>
            )}
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Amount</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Balance</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Category</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr key={idx} className={`border-b border-gray-100 ${row.isDuplicate ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                    <td className="px-3 py-2 text-gray-600">{row.date || "--"}</td>
                    <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate">{row.description || "--"}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {row.amount != null ? row.amount.toFixed(2) : row.debit ? `-${row.debit.toFixed(2)}` : row.credit ? `+${row.credit.toFixed(2)}` : "--"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{row.balance != null ? row.balance.toFixed(2) : "--"}</td>
                    <td className="px-3 py-2 text-gray-500">{row.category || "--"}</td>
                    <td className="px-3 py-2 text-center">
                      {row.isDuplicate ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Duplicate</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Back</button>
            <button
              onClick={confirmImport}
              disabled={confirming}
              className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {confirming ? "Importing..." : "Confirm Import"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
