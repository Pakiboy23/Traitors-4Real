import React from "react";
import { PlayerEntry } from "../../types";
import { getCastPortraitSrc } from "../../src/castPortraits";
import { InlineEditMap } from "./types";

interface RosterSectionProps {
  players: PlayerEntry[];
  selectedPlayer: PlayerEntry | null;
  onSelectPlayer: (player: PlayerEntry | null) => void;
  inlineEdits: InlineEditMap;
  buildInlineEdit: (player: PlayerEntry) => {
    name: string;
    email: string;
    weeklyBanished: string;
    weeklyMurdered: string;
  };
  updateInlineEdit: (
    player: PlayerEntry,
    updates: Partial<{
      name: string;
      email: string;
      weeklyBanished: string;
      weeklyMurdered: string;
    }>
  ) => void;
  saveInlineEdit: (player: PlayerEntry) => void;
  onDeletePlayer: (playerId: string) => void;
  banishedOptions: string[];
  murderOptions: string[];
  pasteContent: string;
  onPasteContentChange: (value: string) => void;
  onParseAndAdd: () => void;
  editPlayerName: string;
  editPlayerEmail: string;
  editWeeklyBanished: string;
  editWeeklyMurdered: string;
  onEditPlayerNameChange: (value: string) => void;
  onEditPlayerEmailChange: (value: string) => void;
  onEditWeeklyBanishedChange: (value: string) => void;
  onEditWeeklyMurderedChange: (value: string) => void;
  onSavePlayerEdits: () => void;
  onSaveWeeklyEdits: () => void;
  onOpenPlayerAvatarPrompt: () => void;
  castStatus: Record<
    string,
    {
      isWinner: boolean;
      isFirstOut: boolean;
      isTraitor: boolean;
      isEliminated: boolean;
      portraitUrl?: string | null;
    }
  >;
}

const RosterSection: React.FC<RosterSectionProps> = ({
  players,
  selectedPlayer,
  onSelectPlayer,
  inlineEdits,
  buildInlineEdit,
  updateInlineEdit,
  saveInlineEdit,
  onDeletePlayer,
  banishedOptions,
  murderOptions,
  pasteContent,
  onPasteContentChange,
  onParseAndAdd,
  editPlayerName,
  editPlayerEmail,
  editWeeklyBanished,
  editWeeklyMurdered,
  onEditPlayerNameChange,
  onEditPlayerEmailChange,
  onEditWeeklyBanishedChange,
  onEditWeeklyMurderedChange,
  onSavePlayerEdits,
  onSaveWeeklyEdits,
  onOpenPlayerAvatarPrompt,
  castStatus,
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-5">
      <section className="soft-card rounded-3xl p-5 md:p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">League Directory</p>
          <h3 className="headline text-2xl">Player roster</h3>
        </div>

        <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
          {players.map((player) => {
            const edit = inlineEdits[player.id] ?? buildInlineEdit(player);
            return (
              <React.Fragment key={player.id}>
                <article
                  className={`soft-card soft-card-subtle rounded-2xl p-3 cursor-pointer ${
                    selectedPlayer?.id === player.id ? "border-[color:var(--accent)]/60" : ""
                  }`}
                  onClick={() => onSelectPlayer(player)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30 flex-shrink-0">
                        {player.portraitUrl ? (
                          <img src={player.portraitUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[color:var(--text-muted)]">
                            {player.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[color:var(--text)] truncate">{player.name}</p>
                        <p className="text-xs text-[color:var(--text-muted)] truncate">{player.email || "No email"}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlayer(player.id);
                      }}
                      className="btn-secondary px-3 text-[10px] border-[color:var(--danger)]/45 text-[color:var(--danger)]"
                    >
                      Delete
                    </button>
                  </div>
                </article>

                <div className="soft-card soft-card-subtle rounded-2xl p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={edit.name}
                      onChange={(e) => updateInlineEdit(player, { name: e.target.value })}
                      className="field-soft p-2 text-xs"
                      placeholder="Name"
                    />
                    <input
                      type="email"
                      value={edit.email}
                      onChange={(e) => updateInlineEdit(player, { email: e.target.value })}
                      className="field-soft p-2 text-xs"
                      placeholder="Email"
                    />
                    <select
                      value={edit.weeklyBanished}
                      onChange={(e) => updateInlineEdit(player, { weeklyBanished: e.target.value })}
                      className="field-soft p-2 text-xs"
                    >
                      <option value="">Next Banished</option>
                      {banishedOptions.map((member) => (
                        <option key={member} value={member}>
                          {member}
                        </option>
                      ))}
                    </select>
                    <select
                      value={edit.weeklyMurdered}
                      onChange={(e) => updateInlineEdit(player, { weeklyMurdered: e.target.value })}
                      className="field-soft p-2 text-xs"
                    >
                      <option value="">Next Murdered</option>
                      {murderOptions.map((member) => (
                        <option key={member} value={member}>
                          {member}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={() => saveInlineEdit(player)} className="btn-primary px-3 text-[10px]">
                      Save Row
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {players.length === 0 && <p className="text-sm text-[color:var(--text-muted)] text-center py-4">No players yet.</p>}
        </div>

        <div className="border-t soft-divider pt-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Manual add</p>
          <textarea
            value={pasteContent}
            onChange={(e) => onPasteContentChange(e.target.value)}
            className="field-soft w-full h-28 p-3 text-xs font-mono"
            placeholder="Paste draft/submission text here..."
          />
          <button type="button" onClick={onParseAndAdd} className="btn-primary w-full py-3 text-xs">
            Parse and Add Player
          </button>
        </div>
      </section>

      <section className="soft-card rounded-3xl p-5 md:p-6 min-h-[420px]">
        {selectedPlayer ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 border-b soft-divider pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30 flex-shrink-0">
                  {selectedPlayer.portraitUrl ? (
                    <img src={selectedPlayer.portraitUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[color:var(--text-muted)]">
                      {selectedPlayer.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="headline text-2xl truncate">{selectedPlayer.name}</p>
                  <button type="button" onClick={onOpenPlayerAvatarPrompt} className="btn-secondary mt-2 px-3 text-[10px]">
                    Set Avatar URL
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => onSelectPlayer(null)} className="btn-secondary px-3 text-[10px]">
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="soft-card soft-card-subtle rounded-2xl p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">First Out</p>
                <p className="text-sm font-semibold text-[color:var(--text)] mt-1">{selectedPlayer.predFirstOut || "None"}</p>
              </div>
              <div className="soft-card soft-card-subtle rounded-2xl p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Winner</p>
                <p className="text-sm font-semibold text-[color:var(--text)] mt-1">{selectedPlayer.predWinner || "None"}</p>
              </div>
            </div>

            <div className="soft-card soft-card-subtle rounded-2xl p-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Edit player profile</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editPlayerName}
                  onChange={(e) => onEditPlayerNameChange(e.target.value)}
                  className="field-soft p-3 text-sm"
                  placeholder="Name"
                />
                <input
                  type="email"
                  value={editPlayerEmail}
                  onChange={(e) => onEditPlayerEmailChange(e.target.value)}
                  className="field-soft p-3 text-sm"
                  placeholder="Email"
                />
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={onSavePlayerEdits} className="btn-primary px-4 text-[11px]">
                  Save Player
                </button>
              </div>
            </div>

            <div className="soft-card soft-card-subtle rounded-2xl p-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Edit Weekly Council</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={editWeeklyBanished}
                  onChange={(e) => onEditWeeklyBanishedChange(e.target.value)}
                  className="field-soft p-3 text-sm"
                >
                  <option value="">Next Banished</option>
                  {banishedOptions.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
                <select
                  value={editWeeklyMurdered}
                  onChange={(e) => onEditWeeklyMurderedChange(e.target.value)}
                  className="field-soft p-3 text-sm"
                >
                  <option value="">Next Murdered</option>
                  {murderOptions.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={onSaveWeeklyEdits} className="btn-primary px-4 text-[11px]">
                  Save Weekly Vote
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-3">Draft picks</p>
              <div className="grid grid-cols-1 gap-2">
                {selectedPlayer.picks.map((pick, index) => {
                  const pickPortrait = getCastPortraitSrc(
                    pick.member,
                    castStatus[pick.member]?.portraitUrl
                  );
                  return (
                    <div key={`${pick.member}-${index}`} className="soft-card soft-card-subtle rounded-2xl p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-[color:var(--text-muted)]">#{index + 1}</span>
                        <div className="w-6 h-6 rounded-full overflow-hidden border border-[color:var(--panel-border)] bg-black/30 flex-shrink-0">
                          {pickPortrait ? (
                            <img src={pickPortrait} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-[color:var(--text-muted)]">
                              {pick.member.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-[color:var(--text)] truncate">{pick.member}</span>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full ${
                          pick.role === "Traitor"
                            ? "bg-[color:var(--danger)]/20 text-[color:var(--danger)]"
                            : "bg-[color:var(--success)]/20 text-[color:var(--success)]"
                        }`}
                      >
                        {pick.role}
                      </span>
                    </div>
                  );
                })}
                {selectedPlayer.picks.length === 0 && (
                  <p className="text-sm text-[color:var(--text-muted)]">No draft picks recorded.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[340px] flex items-center justify-center text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Player detail panel</p>
              <p className="headline text-2xl mt-2">Select a player</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default RosterSection;
