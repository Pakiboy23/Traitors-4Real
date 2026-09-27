"use client";

import React, { useEffect, useState } from "react";
import {
  capturedRecoveryHref,
  clearPasswordRecovery,
  ensurePasswordRecoveryListener,
  markPasswordRecovery,
  passwordRecoveryEventSeen,
} from "../../lib/passwordRecovery";
import { supabase } from "../../lib/supabase";
import PasswordResetRequest from "../../../components/PasswordResetRequest";
import { updateAdminPassword } from "../../../services/supabase";
import { PremiumButton, PremiumField, PremiumPanelHeader } from "../../ui/premium";
import {
  adminEntryUrl,
  classifyRecoveryUrl,
  INVALID_RESET_LINK_MESSAGE,
  passwordUpdateErrorMessage,
  resolveRecoveryPhase,
  validateNewPassword,
  type RecoveryPhase,
} from "../../utils/passwordReset";
import ResetPasswordFrame from "./ResetPasswordFrame";

// passwordRecovery is imported above every module that constructs the
// Supabase client. Its first import snapshots location.href, then the
// client starts, then the PASSWORD_RECOVERY listener is attached.
ensurePasswordRecoveryListener();

const recoveryUrl = classifyRecoveryUrl(capturedRecoveryHref);

const phaseCopy = (phase: RecoveryPhase): { title: string; description: string } => {
  switch (phase) {
    case "checking":
      return {
        title: "Reset password",
        description: "Checking your reset link.",
      };
    case "ready":
      return {
        title: "Choose a new password",
        description: "This replaces the admin password. You'll go straight into Admin after it saves.",
      };
    case "invalid":
      return {
        title: "Reset link expired",
        description: "Request another email and open the newest link.",
      };
    case "request":
      return {
        title: "Reset password",
        description: "Enter the admin email to request a reset link.",
      };
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};

const flushRecoveryEvent = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0);
});

const ResetPassword: React.FC = () => {
  const [settled, setSettled] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [recoveryEventSeen, setRecoveryEventSeen] = useState(() => passwordRecoveryEventSeen());
  const [linkRejected, setLinkRejected] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event !== "PASSWORD_RECOVERY") return;
      markPasswordRecovery();
      setRecoveryEventSeen(true);
      if (session) setHasSession(true);
    });

    void (async () => {
      await supabase.auth.initialize();
      // PASSWORD_RECOVERY is queued on a timer as initialize() resolves.
      await flushRecoveryEvent();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const session = Boolean(data.session);
      const seen = passwordRecoveryEventSeen();
      if (session && (recoveryUrl.kind === "recovery" || seen)) {
        markPasswordRecovery();
        setRecoveryEventSeen(true);
      } else {
        setRecoveryEventSeen(seen);
      }
      setHasSession(session);
      setSettled(true);
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const resolved = resolveRecoveryPhase({
    url: recoveryUrl,
    recoveryEventSeen,
    hasSession,
    settled,
  });
  const phase: RecoveryPhase = linkRejected ? "invalid" : resolved;
  const copy = phaseCopy(phase);

  const openAdmin = () => {
    window.location.assign(adminEntryUrl(window.location.origin));
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateNewPassword(password, confirmation);
    if (validation) {
      setFormError(validation);
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await updateAdminPassword(password);
      clearPasswordRecovery();
      openAdmin();
    } catch (error) {
      const message = passwordUpdateErrorMessage(error);
      setFormError(message);
      if (message === INVALID_RESET_LINK_MESSAGE) {
        clearPasswordRecovery();
        setLinkRejected(true);
      }
      setIsSubmitting(false);
    }
  };

  const body = (() => {
    switch (phase) {
      case "checking":
        return null;
      case "ready":
        return (
          <form onSubmit={handlePasswordSubmit} className="space-y-2.5">
            <PremiumField
              id="new-password"
              label="New password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
              minLength={6}
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? "reset-password-error" : undefined}
              className="premium-input-compact"
            />
            <PremiumField
              id="confirm-password"
              label="Confirm password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              required
              minLength={6}
              aria-invalid={Boolean(formError)}
              className="premium-input-compact"
            />

            {formError && (
              <p
                id="reset-password-error"
                className="text-xs uppercase tracking-[0.16em] text-[color:var(--danger)] font-semibold"
                role="alert"
              >
                {formError}
              </p>
            )}

            <PremiumButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Update password"}
            </PremiumButton>
          </form>
        );
      case "invalid":
      case "request":
        return (
          <>
            {phase === "invalid" && (
              <p className="text-sm leading-relaxed text-[color:var(--danger)]" role="alert">
                {INVALID_RESET_LINK_MESSAGE}
              </p>
            )}
            <PasswordResetRequest idPrefix="reset-page" onCancel={openAdmin} />
          </>
        );
      default: {
        const exhaustive: never = phase;
        return exhaustive;
      }
    }
  })();

  return (
    <ResetPasswordFrame>
      <PremiumPanelHeader kicker="Restricted" title={copy.title} description={copy.description} />
      {body}
    </ResetPasswordFrame>
  );
};

export default ResetPassword;
