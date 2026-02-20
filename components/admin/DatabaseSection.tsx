import React from "react";

interface DatabaseSectionProps {
  saveStatus: string;
  onSaveNow?: () => void;
  onSignOut?: () => void;
  onDownloadGameState: () => void;
  onClearAllPortraits: () => void;
  isManagingTome: boolean;
  onToggleManagingTome: () => void;
  gameStateJson: string;
  onHandleTomeImport: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const DatabaseSection: React.FC<DatabaseSectionProps> = ({
  saveStatus,
  onSaveNow,
  onSignOut,
  onDownloadGameState,
  onClearAllPortraits,
  isManagingTome,
  onToggleManagingTome,
  gameStateJson,
  onHandleTomeImport,
}) => {
  return (
    <div className="space-y-5">
      <section className="soft-card rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Persistence</p>
            <h3 className="headline text-2xl">Storage controls</h3>
            <p className="text-sm text-[color:var(--text-muted)]">{saveStatus}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onSaveNow && (
              <button type="button" onClick={onSaveNow} className="btn-primary px-4 text-[11px]">
                Save Now
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="btn-secondary px-4 text-[11px] border-[color:var(--danger)]/45 text-[color:var(--danger)]"
              >
                Sign Out
              </button>
            )}
            <button type="button" onClick={onDownloadGameState} className="btn-secondary px-4 text-[11px]">
              Download JSON
            </button>
            <button
              type="button"
              onClick={onClearAllPortraits}
              className="btn-secondary px-4 text-[11px] border-[color:var(--danger)]/45 text-[color:var(--danger)]"
            >
              Clear Portraits
            </button>
          </div>
        </div>
      </section>

      <section className="soft-card rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Raw Import</p>
            <h3 className="headline text-2xl">GameState JSON</h3>
          </div>
          <button type="button" onClick={onToggleManagingTome} className="btn-secondary px-4 text-[11px]">
            {isManagingTome ? "Hide Editor" : "Show Editor"}
          </button>
        </div>

        {isManagingTome && (
          <textarea
            className="field-soft w-full h-40 p-4 text-xs font-mono"
            defaultValue={gameStateJson}
            onChange={onHandleTomeImport}
            placeholder="Paste full GameState JSON here..."
          />
        )}
      </section>
    </div>
  );
};

export default DatabaseSection;
