import React from "react";
import { UiVariant } from "../types";

interface ConfirmationCardProps {
  playerName: string;
  onReset: () => void;
  uiVariant?: UiVariant;
}

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({ playerName, onReset, uiVariant }) => {
  if (uiVariant === "premium") {
    return (
      <div className="max-w-3xl mx-auto premium-page">
        <div className="premium-card premium-panel-pad premium-stack-sm text-center">
          <p className="premium-kicker">Submission Complete</p>
          <h3 className="premium-title text-3xl md:text-4xl">Draft Locked</h3>
          <p className="premium-subtitle">
            Your season board is now stored and queued for scoring.
          </p>

          <div className="inline-flex items-center justify-center rounded-xl px-4 py-3 bg-white/5">
            <span className="text-2xl md:text-3xl font-semibold text-[color:var(--accent-strong)]">
              {playerName || "Unnamed Player"}
            </span>
          </div>
        </div>

        <div className="text-center">
          <button onClick={onReset} className="premium-btn premium-btn-secondary px-5 text-xs md:text-sm">
            Submit Another Entry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 md:space-y-6">
      <div className="soft-card rounded-3xl p-6 sm:p-8 md:p-10 relative">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />

        <div className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Submission Complete</p>
          <h3 className="headline text-4xl md:text-5xl">Draft locked</h3>
          <p className="text-base md:text-lg text-[color:var(--text-muted)]">Your season board is now stored and queued for scoring.</p>

          <div className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--panel-border-strong)] px-4 py-3 bg-black/20">
            <span className="headline text-2xl md:text-3xl text-[color:var(--accent)]">{playerName || "Unnamed Player"}</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button onClick={onReset} className="btn-secondary px-5 py-2.5 text-sm">
          Submit Another Entry
        </button>
      </div>
    </div>
  );
};

export default ConfirmationCard;
