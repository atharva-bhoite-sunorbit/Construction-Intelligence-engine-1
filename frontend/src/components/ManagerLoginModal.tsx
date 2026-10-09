import React, { useState } from 'react';
import { X, Lock, Mail, ShieldCheck, UserCheck, AlertCircle, Sparkles, LogIn, Check } from 'lucide-react';
import { apiClient } from '../api/client';
import { User } from '../types';

interface ManagerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
}

export const ManagerLoginModal: React.FC<ManagerLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('pm@construction.ai');
  const [password, setPassword] = useState('pm123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiClient.login(email.trim(), password);
      setSuccessMsg(`Welcome, ${res.user.full_name}! Authenticated as ${res.user.role}.`);
      onLoginSuccess(res.user);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userEmail: string, pass: string) => {
    setEmail(userEmail);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="relative p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Project Manager Authorization Gate
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <LogIn className="w-5 h-5 text-brand-400" />
            Manager Authentication
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Sign in with your manager credentials to review and sign off (YES/NO) on the geotechnical activities plan and project hindrances.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {currentUser && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Currently Signed In:</span>
                <span className="font-bold text-slate-800">{currentUser.full_name}</span>
                <span className="text-slate-500 block text-[11px]">{currentUser.email} • {currentUser.role}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                ACTIVE
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Manager Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. pm@construction.ai"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter manager password"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Quick-Fill Demo Manager Accounts */}
            <div className="pt-1">
              <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
                Quick Select Seed Account (Test All 5 Roles):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => fillCredentials('eng@construction.ai', 'eng123')}
                  className="px-2 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-semibold transition-colors flex items-center gap-1.5 text-left"
                >
                  <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold block truncate">Liam Chen</span>
                    <span className="text-[9px] text-teal-600 font-medium">Site Engineer</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('sm@construction.ai', 'sm123')}
                  className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold transition-colors flex items-center gap-1.5 text-left"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold block truncate">Elena Rostova</span>
                    <span className="text-[9px] text-emerald-600 font-medium">Site Manager</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('admin@construction.ai', 'admin123')}
                  className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-semibold transition-colors flex items-center gap-1.5 text-left"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold block truncate">Alexander Vance</span>
                    <span className="text-[9px] text-blue-600 font-medium">Admin</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('pm@construction.ai', 'pm123')}
                  className="px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-semibold transition-colors flex items-center gap-1.5 text-left"
                >
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold block truncate">Marcus Brody</span>
                    <span className="text-[9px] text-indigo-600 font-medium">Project Manager</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('exec@construction.ai', 'exec123')}
                  className="px-2 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-semibold transition-colors flex items-center gap-1.5 text-left col-span-2 sm:col-span-1"
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold block truncate">Sophia Sterling</span>
                    <span className="text-[9px] text-purple-600 font-medium">Top Management</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Authorize as Manager</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
