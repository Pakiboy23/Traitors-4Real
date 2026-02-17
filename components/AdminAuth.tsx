import React, { useState } from "react";

interface AdminAuthProps {
  onAuthenticate: (email: string, password: string) => Promise<boolean>;
}

const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthenticate }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onAuthenticate(email, password);
    setIsSubmitting(false);

    if (!success) {
      setError(true);
      setPassword("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8 md:mt-12">
      <div className="soft-card rounded-3xl p-6 md:p-8">
        <div className="space-y-2 text-center mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Restricted Area</p>
          <h2 className="headline text-3xl">Admin access</h2>
          <p className="text-sm text-[color:var(--text-muted)]">Sign in to manage scoring, cast status, and submissions.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className={`field-soft p-3.5 ${error ? "border-[color:var(--danger)] animate-shake" : ""}`}
            autoComplete="email"
            required
            aria-invalid={error}
          />
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={`field-soft p-3.5 ${error ? "border-[color:var(--danger)] animate-shake" : ""}`}
            autoComplete="current-password"
            required
            aria-invalid={error}
            aria-describedby={error ? "login-error" : undefined}
          />

          {error && (
            <p id="login-error" className="text-xs uppercase tracking-[0.16em] text-[color:var(--danger)] font-semibold" role="alert">
              Authentication failed
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-3.5 text-xs md:text-sm" aria-busy={isSubmitting}>
            {isSubmitting && <span className="loading-spinner mr-2" aria-hidden="true" />}
            {isSubmitting ? "Verifying..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminAuth;
