import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, Calendar, User, Hash, Briefcase, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { StockInLog, StockOutLog } from "../types";

interface HistoryLogsProps {
  stockInLogs: StockInLog[];
  stockOutLogs: StockOutLog[];
  inPagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  outPagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  onRefresh: () => void;
  onPageChange: (tab: "in" | "out", page: number) => void;
  onLimitChange: (tab: "in" | "out", limit: number) => void;
  onSearchChange: (tab: "in" | "out", search: string) => void;
  inSearchTerm: string;
  outSearchTerm: string;
}

export default function HistoryLogs({
  stockInLogs,
  stockOutLogs,
  inPagination,
  outPagination,
  onRefresh,
  onPageChange,
  onLimitChange,
  onSearchChange,
  inSearchTerm,
  outSearchTerm
}: HistoryLogsProps) {
  const [activeTab, setActiveTab] = useState<"in" | "out">("in");

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Ledger logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Historical ledger and transaction trails for all stock movements in and out of storage.
          </p>
        </div>
        <div>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Ledger
          </button>
        </div>
      </div>

      {/* Tabs list & Search bar */}
      <div className="bg-white p-4 border border-slate-200/80 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex p-1 bg-slate-100 rounded-lg w-full sm:w-auto relative">
            <button
              onClick={() => setActiveTab("in")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer relative z-10 ${
                activeTab === "in"
                  ? "text-slate-950 font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              Stock Inward Records ({inPagination.totalItems})
              {activeTab === "in" && (
                <motion.div 
                  layoutId="activeHistoryTabUnderlay"
                  className="absolute inset-0 bg-white rounded-md shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("out")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer relative z-10 ${
                activeTab === "out"
                  ? "text-slate-950 font-bold"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              <ArrowUpRight className="h-4 w-4 text-amber-600" />
              Stock Outward Sales ({outPagination.totalItems})
              {activeTab === "out" && (
                <motion.div 
                  layoutId="activeHistoryTabUnderlay"
                  className="absolute inset-0 bg-white rounded-md shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "in" 
                  ? "Search by SKU, Product or Batch..." 
                  : "Search by SKU, Product or Customer..."
              }
              value={activeTab === "in" ? inSearchTerm : outSearchTerm}
              onChange={(e) => onSearchChange(activeTab, e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-slate-950 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "in" ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Entry ID</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Product / SKU</th>
                    <th className="py-3 px-6 text-right">Quantity In</th>
                    <th className="py-3 px-6">Batch Reference</th>
                    <th className="py-3 px-6">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {stockInLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No stock in logs recorded.
                      </td>
                    </tr>
                  ) : (
                    stockInLogs.map((log, idx) => (
                      <motion.tr 
                        key={log.entry_id} 
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                        className="hover:bg-slate-50/50"
                      >
                        <td className="py-4 px-6 font-mono text-xs text-slate-600">
                          #{log.entry_id}
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-medium text-xs whitespace-nowrap">
                          {formatDate(log.date)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-semibold text-slate-900 block">{log.product_name}</span>
                          <span className="font-mono text-xs text-slate-400 font-semibold">{log.sku}</span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-emerald-600 whitespace-nowrap">
                          +{log.quantity_added.toLocaleString()} {log.unit}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          {log.batch_number ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                              {log.batch_number}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap text-xs font-medium text-slate-700">
                          {log.added_by}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Stock Inward Pagination Toolbar */}
            <div className="mt-4 px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {inPagination.totalItems === 0 ? 0 : (inPagination.page - 1) * inPagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-700">
                  {Math.min(inPagination.page * inPagination.limit, inPagination.totalItems)}
                </span>{" "}
                of <span className="font-semibold text-slate-700">{inPagination.totalItems}</span> entries
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Show</span>
                  <select
                    value={inPagination.limit}
                    onChange={(e) => onLimitChange("in", Number(e.target.value))}
                    className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[5, 10, 20, 50].map((s) => (
                      <option key={s} value={s}>
                        {s} rows
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex -space-x-px rounded-md shadow-xs bg-white border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    disabled={inPagination.page === 1}
                    onClick={() => onPageChange("in", inPagination.page - 1)}
                    className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: inPagination.totalPages }, (_, i) => i + 1).map((p) => {
                    const isActive = p === inPagination.page;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange("in", p)}
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
                    disabled={inPagination.page === inPagination.totalPages || inPagination.totalPages === 0}
                    onClick={() => onPageChange("in", inPagination.page + 1)}
                    className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Sale ID</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Product / SKU</th>
                    <th className="py-3 px-6 text-right">Quantity Out</th>
                    <th className="py-3 px-6">Customer / Order ID</th>
                    <th className="py-3 px-6">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {stockOutLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No stock out sales logs recorded.
                      </td>
                    </tr>
                  ) : (
                    stockOutLogs.map((log, idx) => (
                      <motion.tr 
                        key={log.sale_id} 
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                        className="hover:bg-slate-50/50"
                      >
                        <td className="py-4 px-6 font-mono text-xs text-slate-600">
                          #{log.sale_id}
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-medium text-xs whitespace-nowrap">
                          {formatDate(log.date)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-semibold text-slate-900 block">{log.product_name}</span>
                          <span className="font-mono text-xs text-slate-400 font-semibold">{log.sku}</span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-amber-600 whitespace-nowrap">
                          -{log.quantity_sold.toLocaleString()} {log.unit}
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-800">
                          {log.customer_name}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap text-xs font-medium text-slate-700">
                          {log.sold_by}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Stock Outward Pagination Toolbar */}
            <div className="mt-4 px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {outPagination.totalItems === 0 ? 0 : (outPagination.page - 1) * outPagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-700">
                  {Math.min(outPagination.page * outPagination.limit, outPagination.totalItems)}
                </span>{" "}
                of <span className="font-semibold text-slate-700">{outPagination.totalItems}</span> entries
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Show</span>
                  <select
                    value={outPagination.limit}
                    onChange={(e) => onLimitChange("out", Number(e.target.value))}
                    className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[5, 10, 20, 50].map((s) => (
                      <option key={s} value={s}>
                        {s} rows
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex -space-x-px rounded-md shadow-xs bg-white border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    disabled={outPagination.page === 1}
                    onClick={() => onPageChange("out", outPagination.page - 1)}
                    className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: outPagination.totalPages }, (_, i) => i + 1).map((p) => {
                    const isActive = p === outPagination.page;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange("out", p)}
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
                    disabled={outPagination.page === outPagination.totalPages || outPagination.totalPages === 0}
                    onClick={() => onPageChange("out", outPagination.page + 1)}
                    className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
