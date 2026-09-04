import React, { useState } from "react";
import { UiVariant } from "../types";
import { PremiumButton, PremiumCard, PremiumField, PremiumPanelHeader } from "../src/ui/premium";

interface AdminAuthProps {
  onAuthenticate: (email: string, password: string) => Promise<boolean>;
  authError?: string | null;
  uiVariant: UiVariant;
}

const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthenticate, authError, uiVariant }) => {
  const isPremiumUi = uiVariant === "premium";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const error = authError || localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);
    const success = await onAuthenticate(email, password);
    setIsSubmitting(false);

    if (!success) {
      setPassword("");
      // Parent-owned authError survives a remount; this is only a fallback
      // if the form stayed mounted and App did not lift a message.
      if (!authError) {
        setLocalError("Authentication failed");
      }
    }
  };

  return (
    <div className={`max-w-lg mx-auto mt-8 md:mt-12 ${isPremiumUi ? "premium-page premium-admin-auth" : ""}`}>
      <PremiumCard className="premium-panel-pad premium-stack-md">
        <PremiumPanelHeader
          kicker="Restricted"
          title="Admin Access"
          description="Authenticate to manage submissions, cast status, and persistence controls."
        />

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <PremiumField
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            autoComplete="email"
            required
            aria-invalid={Boolean(error)}
            className="premium-input-compact"
          />
          <PremiumField
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            className="premium-input-compact"
          />

          {error && (
            <p id="login-error" className="text-xs uppercase tracking-[0.16em] text-[color:var(--danger)] font-semibold" role="alert">
              {error}
            </p>
          )}

          <PremiumButton type="submit" variant="primary" disabled={isSubmitting} className="w-full" aria-busy={isSubmitting}>
            {isSubmitting ? "Verifying..." : "Sign In"}
          </PremiumButton>
        </form>
      </PremiumCard>
    </div>
  );
};

export default AdminAuth;
