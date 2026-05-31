import React, { useState, useEffect } from "react";
import { PlusCircle, Search, Calendar, FolderSymlink, CheckCircle2, AlertCircle } from "lucide-react";
import { Product, User } from "../types";

interface StockInFormProps {
  products: Product[];
  currentUser: User;
  onSubmitStockIn: (entry: {
    product_id: number;
    quantity_added: number;
    date: string;
    batch_number: string;
    added_by: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function StockInForm({ products, currentUser, onSubmitStockIn }: StockInFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [batchNumber, setBatchNumber] = useState<string>("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Set default date-time to current local time on mount
  useEffect(() => {
    const now = new Date();
    const formatted = now.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
    setDate(formatted);
  }, []);

  // Find info of the currently selected product
  const selectedProduct = products.find((p) => p.product_id === Number(selectedProductId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedProductId) {
      setError("Please select a product from the database.");
      return;
    }

    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError("Please specify a valid positive quantity greater than zero.");
      return;
    }

    if (!date) {
      setError("Please select the transaction date.");
      return;
    }

    setLoading(true);
    try {
      const res = await onSubmitStockIn({
        product_id: Number(selectedProductId),
        quantity_added: qty,
        date,
        batch_number: batchNumber.trim(),
        added_by: currentUser.username,
      });

      if (res.success) {
        setSuccessMsg(`Successfully recorded Stock-In: added ${qty} ${selectedProduct?.unit || ""} entries to ${selectedProduct?.product_name || ""}`);
        // Reset partial inputs
        setQuantity("");
        setBatchNumber("");
      } else {
        setError(res.error || "Failed to submit stock transaction.");
      }
    } catch (err) {
      setError("An unexpected server communication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stock Entry Module (Inflow)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Record newly manufactured, purchased, or incoming stock to increase warehouse inventory level.
        </p>
      </div>

      <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-md flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 font-medium">{successMsg}</p>
            </div>
          )}

          {/* Product Select dropdown */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Select Product *
            </label>
            <div className="mt-1 relative rounded-md">
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-md text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
              >
                <option value="">-- Choose from Catalog --</option>
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} - [SKU: {p.sku}]
                  </option>
                ))}
              </select>
            </div>
            {selectedProduct && (
              <p className="mt-2 text-xs text-slate-500 font-medium">
                Current Storage Volume: <span className="text-slate-800 font-bold">{selectedProduct.current_quantity} {selectedProduct.unit}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Quantity Added *
              </label>
              <div className="mt-1 relative rounded-md">
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="block w-full px-3.5 py-2 border border-slate-200 rounded-md text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                />
                {selectedProduct && (
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium font-mono">
                    {selectedProduct.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Date & Time of Entry *
              </label>
              <div className="mt-1 relative rounded-md">
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full px-3.5 py-2 border border-slate-200 rounded-md text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          {/* Batch number / reference */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Batch Number / Reference <span className="text-slate-400 lowercase italic">(optional)</span>
            </label>
            <div className="mt-1 relative rounded-md">
              <input
                type="text"
                placeholder="e.g. BATCH-2023-QA0"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="block w-full px-3.5 py-2 border border-slate-200 rounded-md text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
              />
            </div>
          </div>

          {/* User ID display */}
          <div className="bg-slate-50 px-4 py-2.5 rounded-md border border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Logged Ledger User:</span>
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {currentUser.full_name} ({currentUser.role})
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer disabled:opacity-55"
          >
            <PlusCircle className="h-5 w-5" />
            {loading ? "Recording Transaction..." : "Confirm Stock In-flow"}
          </button>
        </form>
      </div>
    </div>
  );
}
