import React, { useState } from "react";
import { Search, AlertTriangle, ShieldCheck, Plus, X, Tag, Package, RefreshCw, BarChart3, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, DashboardStats, User } from "../types";

interface DashboardProps {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  stats: DashboardStats;
  currentUser: User;
  onRefresh: () => void;
  onAddNewProduct: (newProd: { product_name: string; sku: string; current_quantity: number; min_threshold: number; unit: string }) => Promise<any>;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSearchChange: (search: string) => void;
  onFilterChange: (filter: "all" | "low") => void;
  searchTerm: string;
  filterType: "all" | "low";
}

export default function Dashboard({
  products,
  pagination,
  stats,
  currentUser,
  onRefresh,
  onAddNewProduct,
  onPageChange,
  onLimitChange,
  onSearchChange,
  onFilterChange,
  searchTerm,
  filterType
}: DashboardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states for new product
  const [newProductName, setNewProductName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newUnit, setNewUnit] = useState("Pieces");
  const [newMinThreshold, setNewMinThreshold] = useState("10");
  const [newInitialQuantity, setNewInitialQuantity] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  // Standard units
  const unitsList = ["Pieces", "Meters", "kg", "Liters", "Boxes", "Rolls", "Sets"];

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newProductName.trim() || !newSku.trim() || !newUnit) {
      setFormError("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await onAddNewProduct({
        product_name: newProductName.trim(),
        sku: newSku.trim().toUpperCase(),
        unit: newUnit,
        min_threshold: Number(newMinThreshold) || 0,
        current_quantity: Number(newInitialQuantity) || 0,
      });

      if (res && res.error) {
        setFormError(res.error);
      } else {
        // Success
        setIsModalOpen(false);
        // Clear form
        setNewProductName("");
        setNewSku("");
        setNewUnit("Pieces");
        setNewMinThreshold("10");
        setNewInitialQuantity("0");
      }
    } catch (err) {
      setFormError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header section with identity */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time tracking of manufacturing assets, current storage volumes, and shipping flows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total products */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all duration-300 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/40 rounded-full blur-xl group-hover:bg-blue-100/50 transition-colors" />
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <Package className="h-6 w-6" />
          </div>
          <div className="z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total SKUs</span>
            <span className="text-2xl font-bold text-slate-900">{stats.totalSKUs}</span>
          </div>
        </motion.div>

        {/* Low stock alerts */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className={`p-5 rounded-2xl border shadow-xs flex items-center gap-4 transition-all duration-300 hover:shadow-md relative overflow-hidden group ${
            stats.lowStockAlerts > 0 
              ? "bg-red-50/60 border-red-200 text-red-900 hover:border-red-300" 
              : "bg-white border-slate-200/80 hover:border-red-200"
          }`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50/40 rounded-full blur-xl" />
          <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 ${
            stats.lowStockAlerts > 0 ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-50 text-slate-500"
          }`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Alerts</span>
            <span className={`text-2xl font-bold ${stats.lowStockAlerts > 0 ? "text-red-600" : "text-slate-900"}`}>
              {stats.lowStockAlerts}
            </span>
          </div>
        </motion.div>

        {/* Total Stock Inflow */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:border-emerald-200 hover:shadow-md transition-all duration-300 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/40 rounded-full blur-xl group-hover:bg-emerald-100/50 transition-colors" />
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Inflow</span>
            <span className="text-2xl font-bold text-slate-900">{stats.totalInflow.toLocaleString()} <span className="text-xs font-semibold text-slate-500">units</span></span>
          </div>
        </motion.div>

        {/* Total Stock Outflow */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:border-amber-200 hover:shadow-md transition-all duration-300 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/40 rounded-full blur-xl group-hover:bg-amber-100/50 transition-colors" />
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div className="z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outflow</span>
            <span className="text-2xl font-bold text-slate-900">{stats.totalOutflow.toLocaleString()} <span className="text-xs font-semibold text-slate-500">units</span></span>
          </div>
        </motion.div>
      </div>

      {/* Main Stock Inventory Ledger table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filters header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU or Product name..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-md text-slate-950 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => onFilterChange("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                filterType === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Products
            </button>
            <button
              onClick={() => onFilterChange("low")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1 ${
                filterType === "low"
                  ? "bg-red-600 text-white"
                  : "bg-white text-red-600 border border-slate-200 hover:bg-red-50"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              Low Stock Alert
            </button>
          </div>
        </div>

        {/* Product SKU table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-6">SKU Code</th>
                <th className="py-3 px-6">Product Description</th>
                <th className="py-3 px-6 text-right">Current Stock</th>
                <th className="py-3 px-6">Unit</th>
                <th className="py-3 px-6 text-right">Minimum Level</th>
                <th className="py-3 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                products.map((product, idx) => {
                  const isLow = product.current_quantity < product.min_threshold;
                  return (
                    <motion.tr
                      key={product.product_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isLow ? "bg-red-50/20" : ""
                      }`}
                    >
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-700">
                        {product.sku}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-900">
                        {product.product_name}
                      </td>
                      <td className={`py-4 px-6 text-right font-bold ${
                        isLow ? "text-red-600 text-base" : "text-slate-900"
                      }`}>
                        {product.current_quantity.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-xs">
                        {product.unit}
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-slate-600">
                        {product.min_threshold.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 animate-pulse">
                            <AlertTriangle className="h-3 w-3" />
                            REORDER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                            <ShieldCheck className="h-3 w-3" />
                            OK
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Premium Pagination Toolbar */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Item count helper */}
          <div className="text-xs text-slate-500 font-medium">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-700">
              {Math.min(pagination.page * pagination.limit, pagination.totalItems)}
            </span>{" "}
            of <span className="font-semibold text-slate-700">{pagination.totalItems}</span> entries
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            {/* Page Size Select */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Show</span>
              <select
                value={pagination.limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[5, 10, 20, 50].map((s) => (
                  <option key={s} value={s}>
                    {s} rows
                  </option>
                ))}
              </select>
            </div>

            {/* Page selector buttons */}
            <div className="inline-flex -space-x-px rounded-md shadow-xs bg-white border border-slate-200 overflow-hidden">
              <button
                type="button"
                disabled={pagination.page === 1}
                onClick={() => onPageChange(pagination.page - 1)}
                className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                const isActive = p === pagination.page;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                onClick={() => onPageChange(pagination.page + 1)}
                className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create New Product Dialog / Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
              onClick={() => setIsModalOpen(false)} 
            />
            
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <motion.div 
                initial={{ scale: 0.95, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 15, opacity: 0 }}
                transition={{ type: "spring", duration: 0.45 }}
                className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-200"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <Tag className="h-5 w-5 text-blue-600" />
                    Register New Product
                  </h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleCreateProduct}>
                  <div className="px-6 py-4 space-y-4">
                    {formError && (
                      <div className="flex gap-2 p-3.5 bg-red-50 border-l-4 border-red-500 rounded text-red-800 text-xs font-medium">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{formError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Product Description *
                        </label>
                        <input
                          type="text"
                          required
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="e.g. Galvanized Steel Sheets"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Unique SKU ID *
                        </label>
                        <input
                          type="text"
                          required
                          value={newSku}
                          onChange={(e) => setNewSku(e.target.value)}
                          placeholder="e.g. GSS-GALV-001"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Unit of Measure *
                        </label>
                        <select
                          value={newUnit}
                          onChange={(e) => setNewUnit(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {unitsList.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Minimum Threshold Level *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={newMinThreshold}
                          onChange={(e) => setNewMinThreshold(e.target.value || "")}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Initial Stock Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newInitialQuantity}
                          onChange={(e) => setNewInitialQuantity(e.target.value || "")}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Action buttons */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-55"
                    >
                      {submitting ? "Registering..." : "Add Product"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
