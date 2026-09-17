import React from "react";

interface ConfirmationCardProps {
  playerName: string;
  onReset: () => void;
}

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({ playerName, onReset }) => {
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
};

export default ConfirmationCard;
