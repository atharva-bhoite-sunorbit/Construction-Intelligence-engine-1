import React, { useEffect, useState } from 'react';
import { HardHat } from 'lucide-react';
import { apiClient } from '../api/client';
import { User } from '../types';
import { errorText } from './simple/ui';

type DemoRole = { key: string; label: string; description: string };

export const LoginScreen: React.FC<{ onLoginSuccess: (user: User) => void }> = ({ onLoginSuccess }) => {
  const [roles, setRoles] = useState<DemoRole[] | null>(null); // null = still checking
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getDemoRoles().then((r) => alive && setRoles(r));
    return () => { alive = false; };
  }, []);

  const pickRole = async (role: DemoRole) => {
    setBusy(role.key);
    setError(null);
    try {
      onLoginSuccess((await apiClient.demoLogin(role.key)).user);
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('form');
    setError(null);
    try {
      onLoginSuccess((await apiClient.login(email.trim(), password)).user);
    } catch (err: any) {
      setError(err?.response?.status === 401 ? 'Wrong email or password.' : errorText(err));
      setBusy(null);
    }
  };

  const demo = !!roles && roles.length > 0;
  const formVisible = showForm || (roles !== null && !demo);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-amber-400"><HardHat className="h-6 w-6" aria-hidden /></div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Construction Intelligence</h1>
            <p className="text-sm text-slate-500">{demo ? 'Demo: choose a role to continue' : 'Sign in to continue'}</p>
          </div>
        </div>

        {roles === null && <p className="py-6 text-center text-sm text-slate-500" role="status">Loading…</p>}

        {demo && (
          <ul className="space-y-2" aria-label="Roles">
            {roles!.map((r) => (
              <li key={r.key}>
                <button
                  onClick={() => pickRole(r)}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{r.label}</span>
                    <span className="block text-sm text-slate-500">{r.description}</span>
                  </span>
                  <span className="text-sm text-blue-700">{busy === r.key ? 'Signing in…' : 'Continue'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {formVisible && (
          <form onSubmit={submit} className={demo ? 'mt-5 border-t border-slate-100 pt-5' : ''}>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}
              autoFocus={!demo} className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
            <button type="submit" disabled={busy !== null || !email || !password}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {busy === 'form' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {demo && !formVisible && (
          <button onClick={() => setShowForm(true)} className="mt-5 w-full text-center text-sm text-slate-500 underline hover:text-slate-800">
            Sign in with email instead
          </button>
        )}

        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
      </div>
    </main>
  );
};
