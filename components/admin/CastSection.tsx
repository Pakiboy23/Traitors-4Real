import React from "react";
import { getCastPortraitSrc } from "../../src/castPortraits";

interface CastStatus {
  isWinner: boolean;
  isFirstOut: boolean;
  isTraitor: boolean;
  isEliminated: boolean;
  portraitUrl?: string | null;
}

interface CastSectionProps {
  castNames: string[];
  castStatus: Record<string, CastStatus>;
  defaultStatus: CastStatus;
  onSetCastPortrait: (name: string) => void;
  onUpdateCastMember: (
    name: string,
    field: "isTraitor" | "isEliminated" | "isFirstOut" | "isWinner",
    value: boolean
  ) => void;
}

const CastSection: React.FC<CastSectionProps> = ({
  castNames,
  castStatus,
  defaultStatus,
  onSetCastPortrait,
  onUpdateCastMember,
}) => {
  return (
    <section className="soft-card rounded-3xl p-5 md:p-6 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Cast Controls</p>
        <h3 className="headline text-2xl">Status management</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {castNames.map((name) => {
          const status = castStatus[name] ?? defaultStatus;
          const portraitSrc = getCastPortraitSrc(name, status?.portraitUrl);
          const cardClass = status.isWinner
            ? "border-[color:var(--success)]/55"
            : status.isFirstOut
            ? "border-[color:var(--warning)]/55"
            : status.isEliminated
            ? "border-[color:var(--danger)]/55"
            : status.isTraitor
            ? "border-fuchsia-400/55"
            : "border-[color:var(--panel-border)]";

          return (
            <article key={name} className={`soft-card soft-card-subtle rounded-2xl p-4 space-y-4 border ${cardClass}`}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSetCastPortrait(name)}
                  className="w-8 h-8 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30 flex-shrink-0"
                  title="Set cast portrait"
                >
                  {portraitSrc ? (
                    <img src={portraitSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[color:var(--text-muted)] font-semibold">
                      {name.charAt(0)}
                    </div>
                  )}
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--text)] truncate">{name}</p>
                  <button type="button" onClick={() => onSetCastPortrait(name)} className="text-[11px] text-[color:var(--text-muted)]">
                    Update portrait
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateCastMember(name, "isTraitor", !status?.isTraitor)}
                  className={`rounded-xl border px-2 py-2 text-[11px] uppercase tracking-[0.12em] ${
                    status?.isTraitor
                      ? "bg-[color:var(--danger)] text-black border-[color:var(--danger)]"
                      : "border-[color:var(--panel-border)] text-[color:var(--text-muted)]"
                  }`}
                >
                  Traitor
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCastMember(name, "isEliminated", !status?.isEliminated)}
                  className={`rounded-xl border px-2 py-2 text-[11px] uppercase tracking-[0.12em] ${
                    status?.isEliminated
                      ? "bg-sky-400 text-black border-sky-400"
                      : "border-[color:var(--panel-border)] text-[color:var(--text-muted)]"
                  }`}
                >
                  Eliminated
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCastMember(name, "isFirstOut", !status?.isFirstOut)}
                  className={`rounded-xl border px-2 py-2 text-[11px] uppercase tracking-[0.12em] ${
                    status?.isFirstOut
                      ? "bg-[color:var(--warning)] text-black border-[color:var(--warning)]"
                      : "border-[color:var(--panel-border)] text-[color:var(--text-muted)]"
                  }`}
                >
                  First Out
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCastMember(name, "isWinner", !status?.isWinner)}
                  className={`rounded-xl border px-2 py-2 text-[11px] uppercase tracking-[0.12em] ${
                    status?.isWinner
                      ? "bg-[color:var(--success)] text-black border-[color:var(--success)]"
                      : "border-[color:var(--panel-border)] text-[color:var(--text-muted)]"
                  }`}
                >
                  Winner
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CastSection;
