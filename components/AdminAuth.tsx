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
    <div className="max-w-md mx-auto mt-12 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="glass-panel border border-red-900/60 p-8 rounded-2xl text-center relative overflow-hidden">
        {/* Visual Flourish */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50" />

        <div className="wax-seal mx-auto mb-6 scale-110">
          <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
        </div>

        <h2 className="gothic-font text-2xl text-[color:var(--accent)] mb-2">Admin Access</h2>
        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-8 font-semibold">
          Sign in to manage the draft
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={`w-full bg-black border ${
                error ? 'border-red-600 animate-shake' : 'border-zinc-800'
              } p-4 rounded text-center text-[color:var(--accent)] focus:border-[color:var(--accent)] outline-none transition-all gothic-font tracking-[0.2em]`}
              autoComplete="email"
            />
          </div>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={`w-full bg-black border ${
                error ? 'border-red-600 animate-shake' : 'border-zinc-800'
              } p-4 rounded text-center text-[color:var(--accent)] focus:border-[color:var(--accent)] outline-none transition-all gothic-font tracking-[0.2em]`}
              autoComplete="current-password"
            />
            {error && (
              <p className="text-red-600 text-[10px] uppercase font-semibold mt-2 tracking-[0.2em]">
                Access denied
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-black/60 border border-red-900/60 text-red-100 hover:bg-red-900/40 transition-all gothic-font uppercase tracking-[0.25em] text-xs"
          >
            {isSubmitting ? "Verifying..." : "Unlock Forbidden Tools"}
          </button>
        </form>

        <p className="mt-8 text-[9px] text-zinc-600 uppercase tracking-[0.25em]">
          Admins only
        </p>
      </div>
    </div>
  );
};

export default AdminAuth;
