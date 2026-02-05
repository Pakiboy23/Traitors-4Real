import React, { useState } from 'react';

interface AdminAuthProps {
  onAuthenticate: (email: string, password: string) => Promise<boolean>;
}

const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthenticate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onAuthenticate(email, password);
    setIsSubmitting(false);

    if (!success) {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="glass-panel p-8 rounded-2xl text-center relative overflow-hidden">
        {/* Visual Flourish */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50" />

        <div className="wax-seal mx-auto mb-6 scale-110">
          <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
        </div>

        <h2 className="gothic-font text-3xl text-[color:var(--accent)] mb-3">Admin Access</h2>
        <p className="text-zinc-500 text-xs uppercase tracking-[0.25em] mb-8 font-semibold">
          Sign in to manage the draft
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label htmlFor="admin-email" className="sr-only">Admin Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={`w-full field-soft ${
                error ? 'border-red-600 animate-shake' : 'border-[color:var(--input-border)]'
              } p-4 rounded text-center text-[color:var(--accent)] focus:border-[color:var(--accent)] outline-none transition-all gothic-font tracking-[0.2em]`}
              autoComplete="email"
              aria-required="true"
              aria-invalid={error}
            />
          </div>
          <div className="relative">
            <label htmlFor="admin-password" className="sr-only">Admin Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={`w-full field-soft ${
                error ? 'border-red-600 animate-shake' : 'border-[color:var(--input-border)]'
              } p-4 rounded text-center text-[color:var(--accent)] focus:border-[color:var(--accent)] outline-none transition-all gothic-font tracking-[0.2em]`}
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={error}
              aria-describedby={error ? "login-error" : undefined}
            />
            {error && (
              <p id="login-error" className="text-red-600 text-xs uppercase font-semibold mt-2 tracking-[0.2em]" role="alert">
                Access denied
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 soft-card soft-card-subtle border-red-900/50 text-red-100 hover:bg-red-900/30 transition-all gothic-font uppercase tracking-[0.25em] text-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            aria-busy={isSubmitting}
          >
            {isSubmitting && <span className="loading-spinner" aria-hidden="true" />}
            {isSubmitting ? "Verifying..." : "Unlock Forbidden Tools"}
          </button>
        </form>

        <p className="mt-8 text-xs text-zinc-600 uppercase tracking-[0.25em]">
          Admins only
        </p>
      </div>
    </div>
  );
};

export default AdminAuth;
