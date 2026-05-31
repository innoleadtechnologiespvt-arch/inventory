import { useState, useEffect } from "react";
import {
  Package,
  LayoutDashboard,
  PlusCircle,
  MinusCircle,
  History,
  LogOut,
  User as UserIcon,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import StockInForm from "./components/StockInForm";
import StockOutForm from "./components/StockOutForm";
import HistoryLogs from "./components/HistoryLogs";

import { User, Product, DashboardStats, StockInLog, StockOutLog } from "./types";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("inventory_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<"dashboard" | "stock-in" | "stock-out" | "history">("dashboard");

  // State for Products list (paginated)
  const [products, setProducts] = useState<Product[]>([]);
  const [productsPagination, setProductsPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState<"all" | "low">("all");

  // State for Forms select dropdowns (unpaginated catalog list)
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // State for History Logs (paginated)
  const [stockInLogs, setStockInLogs] = useState<StockInLog[]>([]);
  const [stockInPagination, setStockInPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  const [stockInSearch, setStockInSearch] = useState("");

  const [stockOutLogs, setStockOutLogs] = useState<StockOutLog[]>([]);
  const [stockOutPagination, setStockOutPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  const [stockOutSearch, setStockOutSearch] = useState("");

  // Stats
  const [stats, setStats] = useState<DashboardStats>({
    totalSKUs: 0,
    lowStockAlerts: 0,
    totalInflow: 0,
    totalOutflow: 0
  });

  const [loading, setLoading] = useState(false);

  // Sync session inside LocalStorage
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("inventory_user", JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("inventory_user");
  };

  // 1. Fetch Paginated Products
  const fetchProducts = async (page: number, limit: number, search: string, filter: string) => {
    if (!currentUser || !currentUser.token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&filter=${filter}`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
        setProductsPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch All Products (for select dropdowns in forms)
  const fetchAllProducts = async () => {
    if (!currentUser || !currentUser.token) return;
    try {
      const response = await fetch("/api/products?page=1&limit=10000", {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllProducts(data.products);
      }
    } catch (err) {
      console.error("Failed to fetch all products:", err);
    }
  };

  // 3. Fetch Paginated Stock In Logs
  const fetchStockInLogs = async (page: number, limit: number, search: string) => {
    if (!currentUser || !currentUser.token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/stock-in?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setStockInLogs(data.logs);
        setStockInPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch stock-in logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch Paginated Stock Out Logs
  const fetchStockOutLogs = async (page: number, limit: number, search: string) => {
    if (!currentUser || !currentUser.token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/stock-out?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setStockOutLogs(data.logs);
        setStockOutPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch stock-out logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // 5. Fetch Dashboard Stats
  const fetchStats = async () => {
    if (!currentUser || !currentUser.token) return;
    try {
      const response = await fetch("/api/dashboard-stats", {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  // Fetch initial data based on active tab
  useEffect(() => {
    if (currentUser) {
      if (activeTab === "dashboard") {
        fetchProducts(productsPagination.page, productsPagination.limit, productSearch, productFilter);
        fetchStats();
      } else if (activeTab === "stock-in" || activeTab === "stock-out") {
        fetchAllProducts();
      } else if (activeTab === "history") {
        fetchStockInLogs(stockInPagination.page, stockInPagination.limit, stockInSearch);
        fetchStockOutLogs(stockOutPagination.page, stockOutPagination.limit, stockOutSearch);
      }
    }
  }, [currentUser, activeTab]);

  // Handle Registering a completely new product
  const handleAddNewProduct = async (newProd: {
    product_name: string;
    sku: string;
    current_quantity: number;
    min_threshold: number;
    unit: string;
  }) => {
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ ...newProd, added_by: currentUser?.username || "admin" }),
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return { error: "Session expired or unauthorized. Please log in again." };
      }

      const data = await response.json();
      if (response.ok && data.success) {
        // Refresh products list and stats
        await fetchProducts(productsPagination.page, productsPagination.limit, productSearch, productFilter);
        await fetchStats();
        return { success: true };
      } else {
        return { error: data.error || "Failed to register product." };
      }
    } catch (err) {
      return { error: "Failed to connect to backend server." };
    }
  };

  // Submit Stock-In inwards flow
  const handleStockInSubmit = async (entry: {
    product_id: number;
    quantity_added: number;
    date: string;
    batch_number: string;
    added_by: string;
  }) => {
    try {
      const response = await fetch("/api/stock-in", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify(entry),
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return { success: false, error: "Session expired or unauthorized. Please log in again." };
      }

      const data = await response.json();
      if (response.ok && data.success) {
        // Re-fetch dropdown catalog as stock changes
        await fetchAllProducts();
        return { success: true };
      } else {
        return { success: false, error: data.error || "Failed to record entry." };
      }
    } catch (err) {
      return { success: false, error: "Network connection error." };
    }
  };

  // Submit Stock-Out outward sales flow
  const handleStockOutSubmit = async (sale: {
    product_id: number;
    quantity_sold: number;
    customer_name: string;
    date: string;
    sold_by: string;
  }) => {
    try {
      const response = await fetch("/api/stock-out", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify(sale),
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return { success: false, error: "Session expired or unauthorized. Please log in again." };
      }

      const data = await response.json();
      if (response.ok && data.success) {
        // Re-fetch dropdown catalog as stock changes
        await fetchAllProducts();
        return { success: true };
      } else {
        return { success: false, error: data.error || "Failed to record sale." };
      }
    } catch (err) {
      return { success: false, error: "Network connection error." };
    }
  };

  // Guard routing with Login if unauthorized
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      {/* Top Professional Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 h-9 w-9 rounded-md flex items-center justify-center text-white font-bold shadow-xs">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-slate-800 tracking-tight text-lg">
                  Quantify Ledger
                </span>
                <span className="hidden sm:inline bg-slate-105 text-slate-500 px-2 py-0.5 text-[10px] font-semibold rounded ml-2 border border-slate-200">
                  v1.2.0-stable
                </span>
              </div>
            </div>

            {/* Profile info & logout button */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end text-sm">
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  {currentUser.full_name}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Log Out of Session"
                className="inline-flex items-center gap-1.5 p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50/60 transition-all cursor-pointer text-sm font-semibold border border-transparent hover:border-red-100"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col md:flex-row gap-8">

        {/* Sidebar Nav rail */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="space-y-1.5 bg-white p-3.5 border border-slate-200/80 rounded-xl shadow-xs">

            {/* Nav Title */}
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Navigation Modules
            </p>

            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer relative z-10 ${activeTab === "dashboard"
                  ? "text-blue-600 font-bold"
                  : "text-slate-600 hover:text-slate-950"
                }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Inventory Dashboard
              {activeTab === "dashboard" && (
                <motion.div 
                  layoutId="activeNavUnderlay"
                  className="absolute inset-0 bg-blue-50 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab("stock-in")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer relative z-10 ${activeTab === "stock-in"
                  ? "text-blue-600 font-bold"
                  : "text-slate-600 hover:text-slate-950"
                }`}
            >
              <PlusCircle className="h-4 w-4 text-emerald-600" />
              Stock Entry (Inward)
              {activeTab === "stock-in" && (
                <motion.div 
                  layoutId="activeNavUnderlay"
                  className="absolute inset-0 bg-blue-50 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab("stock-out")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer relative z-10 ${activeTab === "stock-out"
                  ? "text-blue-600 font-bold"
                  : "text-slate-600 hover:text-slate-950"
                }`}
            >
              <MinusCircle className="h-4 w-4 text-amber-600" />
              Sales / Dispatch (Out)
              {activeTab === "stock-out" && (
                <motion.div 
                  layoutId="activeNavUnderlay"
                  className="absolute inset-0 bg-blue-50 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer relative z-10 ${activeTab === "history"
                  ? "text-blue-600 font-bold"
                  : "text-slate-600 hover:text-slate-950"
                }`}
            >
              <History className="h-4 w-4" />
              Audit Trail logs
              {activeTab === "history" && (
                <motion.div 
                  layoutId="activeNavUnderlay"
                  className="absolute inset-0 bg-blue-50 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>

            {/* Mobile User Context indicator */}
            <div className="md:hidden mt-4 pt-4 border-t border-slate-100 flex items-center gap-2.5 px-3">
              <div className="bg-slate-100 p-1.5 rounded-lg text-slate-600">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-800">{currentUser.full_name}</p>
                <p className="text-slate-400 font-medium">{currentUser.role}</p>
              </div>
            </div>
          </nav>
        </aside>

        {/* Workspace Display Area */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <Dashboard
                  products={products}
                  pagination={productsPagination}
                  stats={stats}
                  currentUser={currentUser}
                  onRefresh={() => fetchProducts(productsPagination.page, productsPagination.limit, productSearch, productFilter)}
                  onAddNewProduct={handleAddNewProduct}
                  onPageChange={(page) => fetchProducts(page, productsPagination.limit, productSearch, productFilter)}
                  onLimitChange={(limit) => fetchProducts(1, limit, productSearch, productFilter)}
                  onSearchChange={(search) => {
                    setProductSearch(search);
                    fetchProducts(1, productsPagination.limit, search, productFilter);
                  }}
                  onFilterChange={(filter) => {
                    setProductFilter(filter);
                    fetchProducts(1, productsPagination.limit, productSearch, filter);
                  }}
                  searchTerm={productSearch}
                  filterType={productFilter}
                />
              </motion.div>
            )}

            {activeTab === "stock-in" && (
              <motion.div
                key="stock-in"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <StockInForm
                  products={allProducts}
                  currentUser={currentUser}
                  onSubmitStockIn={handleStockInSubmit}
                />
              </motion.div>
            )}

            {activeTab === "stock-out" && (
              <motion.div
                key="stock-out"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <StockOutForm
                  products={allProducts}
                  currentUser={currentUser}
                  onSubmitStockOut={handleStockOutSubmit}
                />
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <HistoryLogs
                  stockInLogs={stockInLogs}
                  stockOutLogs={stockOutLogs}
                  inPagination={stockInPagination}
                  outPagination={stockOutPagination}
                  onRefresh={() => {
                    fetchStockInLogs(stockInPagination.page, stockInPagination.limit, stockInSearch);
                    fetchStockOutLogs(stockOutPagination.page, stockOutPagination.limit, stockOutSearch);
                  }}
                  onPageChange={(tab, page) => {
                    if (tab === "in") {
                      fetchStockInLogs(page, stockInPagination.limit, stockInSearch);
                    } else {
                      fetchStockOutLogs(page, stockOutPagination.limit, stockOutSearch);
                    }
                  }}
                  onLimitChange={(tab, limit) => {
                    if (tab === "in") {
                      fetchStockInLogs(1, limit, stockInSearch);
                    } else {
                      fetchStockOutLogs(1, limit, stockOutSearch);
                    }
                  }}
                  onSearchChange={(tab, search) => {
                    if (tab === "in") {
                      setStockInSearch(search);
                      fetchStockInLogs(1, stockInPagination.limit, search);
                    } else {
                      setStockOutSearch(search);
                      fetchStockOutLogs(1, stockOutPagination.limit, search);
                    }
                  }}
                  inSearchTerm={stockInSearch}
                  outSearchTerm={stockOutSearch}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Humble Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 text-center text-xs text-slate-400 font-medium font-mono mt-auto">
        <p>Storage Management Dashboard • Internal Ledger Platform • Running on Sandbox Node-SQLite v1.0.0</p>
      </footer>
    </div>
  );
}
