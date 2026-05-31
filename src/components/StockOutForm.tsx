import React, { useState, useEffect } from "react";
import { MinusCircle, User as UserIcon, Calendar, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { Product, User } from "../types";

interface StockOutFormProps {
  products: Product[];
  currentUser: User;
  onSubmitStockOut: (sale: {
    product_id: number;
    quantity_sold: number;
    customer_name: string;
    date: string;
    sold_by: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function StockOutForm({ products, currentUser, onSubmitStockOut }: StockOutFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [date, setDate] = useState<string>("");

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

  // Determine if there's enough stock for the requested quantity (negative stock check!)
  const requestedQty = Number(quantity) || 0;
  const currentAvailableQty = selectedProduct ? selectedProduct.current_quantity : 0;
  const isOutOfStock = selectedProductId !== "" && currentAvailableQty === 0;
  const isInsufficientStock = selectedProductId !== "" && requestedQty > currentAvailableQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedProductId) {
      setError("Please select a product to sell/issue.");
      return;
    }

    const qty = Number(quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      setError("Please specify a valid positive quantity sold.");
      return;
    }

    if (!customerName.trim()) {
      setError("Please enter the name of the customer or associated Order ID.");
      return;
    }

    if (!date) {
      setError("Please select the transaction date.");
      return;
    }

    // Critical Negative Stock prevention validation in browser
    if (qty > currentAvailableQty) {
      setError(`Declined: Requested sale of ${qty} units exceeds the total available stock of ${currentAvailableQty} ${selectedProduct?.unit || "units"}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await onSubmitStockOut({
        product_id: Number(selectedProductId),
        quantity_sold: qty,
        customer_name: customerName.trim(),
        date,
        sold_by: currentUser.username,
      });

      if (res.success) {
        setSuccessMsg(`Successfully recorded Stock-Out: sold ${qty} ${selectedProduct?.unit || ""} units to ${customerName}`);
        // Reset inputs
        setQuantity("");
        setCustomerName("");
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales / Stock Exit Module (Outflow)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Record outgoing stock for customer invoices, distribution orders, or warehouse releases.
        </p>
      </div>

      <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-semibold">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-md flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 font-medium">{successMsg}</p>
            </div>
          )}

          {/* Validation Feedback Banner for Negative Stock */}
          {selectedProduct && isOutOfStock && (
            <div className="bg-red-50 text-red-800 p-4 border border-red-200 rounded-md flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Critical: Out of Stock</h4>
                <p className="text-xs text-red-600 mt-0.5">
                  This item has zero units available! You cannot record any sales until you manufacture or purchase more.
                </p>
              </div>
            </div>
          )}

          {selectedProduct && !isOutOfStock && isInsufficientStock && (
            <div className="bg-amber-50 text-amber-900 p-4 border border-amber-200 rounded-md flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Insufficient Stock Alert</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Requested amount <span className="font-semibold">({requestedQty})</span> exceeds available quantity <span className="font-semibold">({currentAvailableQty} {selectedProduct.unit})</span>.
                  The transaction will be blocked to prevent negative inventory levels.
                </p>
              </div>
            </div>
          )}

          {selectedProduct && !isInsufficientStock && !isOutOfStock && requestedQty > 0 && (
            <div className="bg-slate-50 text-slate-800 p-3.5 border border-slate-200 rounded-md text-xs flex justify-between items-center">
              <span>Post-Sale Projected Stock:</span>
              <span className="font-semibold text-slate-900">
                {(currentAvailableQty - requestedQty).toLocaleString()} {selectedProduct.unit}
              </span>
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
                  <option key={p.product_id} value={p.product_id} disabled={p.current_quantity === 0}>
                    {p.product_name} - [SKU: {p.sku}] ({p.current_quantity} available) {p.current_quantity === 0 ? "(OUT OF STOCK)" : ""}
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
                Quantity Sold / Issued *
              </label>
              <div className="mt-1 relative rounded-md">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  placeholder="0.00"
                  value={quantity}
                  disabled={!selectedProductId || isOutOfStock}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="block w-full px-3.5 py-2 border border-slate-200 rounded-md text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50 disabled:opacity-50"
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
                Date & Time of Transaction *
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

          {/* Customer Name / Order ID */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Customer Name / Order ID *
            </label>
            <div className="mt-1 relative rounded-md">
              <input
                type="text"
                required
                placeholder="e.g. Apex Industries Co. / ORD-1002"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="block w-full px-3.5 py-2 border border-slate-200 rounded-md text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
              />
            </div>
          </div>

          {/* Logged Staff context */}
          <div className="bg-slate-50 px-4 py-2.5 rounded-md border border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Logged Ledger User:</span>
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {currentUser.full_name} ({currentUser.role})
            </span>
          </div>

          <button
            type="submit"
            disabled={loading || isInsufficientStock || isOutOfStock || !selectedProductId}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
          >
            <MinusCircle className="h-5 w-5" />
            {loading ? "Recording Sale..." : "Confirm Stock Out-flow"}
          </button>
        </form>
      </div>
    </div>
  );
}
