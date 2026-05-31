import React, { useState } from "react";
import { Lock, User as UserIcon, AlertCircle, Package } from "lucide-react";
import { motion } from "motion/react";
import { User } from "../types";

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLogin(data.user);
      } else {
        setError(data.error || "Invalid username or password.");
      }
    } catch (err) {
      setError("Failed to connect to the server database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans overflow-hidden bg-grid-pattern">
      {/* Decorative gradient glowing spots */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10"
      >
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-600 text-white shadow-lg mb-6 hover:scale-110 transition-transform duration-300">
          <Package className="h-9 w-9 animate-pulse" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Quantify <span className="text-blue-600 font-light">Ledger</span>
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Sign in to access secure warehouse operations
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10"
      >
        <div className="glass-card py-8 px-4 border border-slate-200/80 rounded-2xl sm:px-10 shadow-xl shadow-slate-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-semibold text-red-800">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Username
              </label>
              <div className="mt-1 relative rounded-md">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white/70 focus:bg-white transition-all shadow-xs"
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Password
              </label>
              <div className="mt-1 relative rounded-md">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white/70 focus:bg-white transition-all shadow-xs"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/10 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-55 cursor-pointer"
              >
                {loading ? "Authenticating..." : "Sign in"}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Authorized Demo Credentials
            </h4>
            <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-500">
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                <span className="font-bold block text-slate-800 mb-0.5">Administrator</span>
                User: <code className="font-mono bg-white px-1 py-0.5 border border-slate-100 rounded text-slate-700">admin</code><br />
                Pass: <code className="font-mono bg-white px-1 py-0.5 border border-slate-100 rounded text-slate-700">admin123</code>
              </div>
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                <span className="font-bold block text-slate-800 mb-0.5">Warehouse Staff</span>
                User: <code className="font-mono bg-white px-1 py-0.5 border border-slate-100 rounded text-slate-700">warehouse</code><br />
                Pass: <code className="font-mono bg-white px-1 py-0.5 border border-slate-100 rounded text-slate-700">warehouse123</code>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
