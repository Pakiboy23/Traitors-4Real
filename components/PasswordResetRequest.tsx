import React, { useState } from "react";
import { requestAdminPasswordReset } from "../services/supabase";
import { PremiumButton, PremiumField } from "../src/ui/premium";

interface PasswordResetRequestProps {
  idPrefix: string;
  initialEmail?: string;
  onCancel?: () => void;
  cancelLabel?: string;
}

const PasswordResetRequest: React.FC<PasswordResetRequestProps> = ({
  idPrefix,
  initialEmail = "",
  onCancel,
  cancelLabel = "Back to sign in",
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setLocalError(null);
    setIsSubmitting(true);
    try {
      const result = await requestAdminPasswordReset(email);
      if (result.tone === "neutral") setNotice(result.message);
      else setLocalError(result.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <PremiumField
        id={`${idPrefix}-email`}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Admin email"
        autoComplete="email"
        required
        aria-invalid={Boolean(localError)}
        aria-describedby={notice || localError ? `${idPrefix}-status` : undefined}
        className="premium-input-compact"
      />

      {notice && (
        <p id={`${idPrefix}-status`} className="text-sm leading-relaxed text-[color:var(--success)]" role="status">
          {notice}
        </p>
      )}

      {localError && (
        <p
          id={`${idPrefix}-status`}
          className="text-xs uppercase tracking-[0.16em] text-[color:var(--danger)] font-semibold"
          role="alert"
        >
          {localError}
        </p>
      )}

      <PremiumButton type="submit" variant="primary" disabled={isSubmitting} className="w-full" aria-busy={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </PremiumButton>

      {onCancel && (
        <PremiumButton type="button" variant="ghost" className="w-full" onClick={onCancel}>
          {cancelLabel}
        </PremiumButton>
      )}
    </form>
  );
};

export default PasswordResetRequest;
