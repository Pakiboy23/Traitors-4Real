import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DraftPick, GameState, PlayerEntry, UiVariant } from "../types";
import ConfirmationCard from "./ConfirmationCard";
import { getCastPortraitSrc } from "../src/castPortraits";
import CastPicker from "./CastPicker";
import { toCastOptions } from "../src/utils/castProfiles";
import { useToast } from "./Toast";
import { logger } from "../src/utils/logger";
import {
  describeDraftWindow,
  readForceClosedFromEnv,
  resolveDraftWindow,
} from "../src/utils/draftWindow";
import {
  cardRevealVariants,
  pageRevealVariants,
  sectionStaggerVariants,
} from "../src/ui/motion";
import {
  PremiumButton,
  PremiumCard,
  PremiumField,
  PremiumPanelHeader,
  PremiumStatusBadge,
} from "../src/ui/premium";
import { submitDraftEntry } from "../services/supabase";

interface DraftFormProps {
  gameState: GameState;
  onAddEntry: (entry: PlayerEntry) => void;
  uiVariant: UiVariant;
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DRAFT_SIZE = 10;
const createEmptyPick = (): DraftPick => ({ member: "", rank: 1, role: "Faithful" });
const createEmptyPicks = () => Array.from({ length: DRAFT_SIZE }, createEmptyPick);

const DraftForm: React.FC<DraftFormProps> = ({ gameState, onAddEntry, uiVariant }) => {
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";

  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [picks, setPicks] = useState<DraftPick[]>(createEmptyPicks());
  const [sealedPicks, setSealedPicks] = useState<boolean[]>(Array(DRAFT_SIZE).fill(false));
  const [predFirstOut, setPredFirstOut] = useState("");
  const [predWinner, setPredWinner] = useState("");
  const [traitors, setTraitors] = useState(["", "", ""]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The season record is the authority on whether the draft accepts entries,
  // so opening it on premiere night is an admin action rather than a redeploy.
  //
  // `now` is state rather than a bare Date.now() so that a form left open
  // across the scheduled lock actually closes: without it the memo would hold
  // the timestamp from first render and keep reporting the draft as open.
  const [now, setNow] = useState(() => Date.now());
  const draftWindow = useMemo(
    () =>
      resolveDraftWindow(gameState, {
        forceClosed: readForceClosedFromEnv(),
        now,
      }),
    [gameState, now]
  );
  const isDraftClosed = !draftWindow.isOpen;

  useEffect(() => {
    if (!draftWindow.isOpen || !draftWindow.lockAt) return;

    const msUntilLock = Date.parse(draftWindow.lockAt) - Date.now();
    if (msUntilLock <= 0) {
      setNow(Date.now());
      return;
    }

    // setTimeout truncates delays beyond a signed 32-bit int, which would fire
    // immediately and spin. Clamp instead; the effect re-arms on each tick and
    // converges on the real lock time.
    const delay = Math.min(msUntilLock + 250, 2_147_483_647);
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [draftWindow.isOpen, draftWindow.lockAt]);
  const castNames = Object.keys(gameState.castStatus || {}).sort((a, b) =>
    a.localeCompare(b)
  );

  const castOptions = useMemo(
    () => toCastOptions(gameState.castStatus || {}),
    [gameState.castStatus]
  );

  const activeCastOptions = useMemo(
    () => castOptions.filter((option) => !option.isEliminated),
    [castOptions]
  );

  const activeCastNames = useMemo(
    () => activeCastOptions.map((option) => option.name),
    [activeCastOptions]
  );

  const duplicateNames = useMemo(() => {
    const selected = picks.map((pick) => pick.member).filter(Boolean);
    const duplicates = selected.filter((item, index) => selected.indexOf(item) !== index);
    return [...new Set(duplicates)];
  }, [picks]);

  const hasDuplicates = duplicateNames.length > 0;
  const sealedCount = sealedPicks.filter(Boolean).length;
  const allPicksSealed = sealedPicks.every(Boolean) && picks.every((pick) => pick.member !== "");

  const updatePick = <K extends keyof DraftPick>(idx: number, field: K, value: DraftPick[K]) => {
    if (sealedPicks[idx]) return;
    const nextPicks = [...picks];
    nextPicks[idx] = { ...nextPicks[idx], [field]: value };
    setPicks(nextPicks);
  };

  const toggleSeal = (idx: number) => {
    if (!picks[idx].member) {
      showToast("Select a player before sealing this slot.", "warning");
      return;
    }
    const next = [...sealedPicks];
    next[idx] = !next[idx];
    setSealedPicks(next);
  };

  const autoGeneratePicks = () => {
    const shuffled = shuffleArray(activeCastNames);
    const selected = shuffled.slice(0, DRAFT_SIZE) as string[];
    const ranks = shuffleArray(Array.from({ length: DRAFT_SIZE }, (_, index) => index + 1));
    const bonusPool = shuffled.slice(DRAFT_SIZE) as string[];

    const nextPicks: DraftPick[] = selected.map((member, index) => ({
      member,
      rank: ranks[index],
      role: Math.random() > 0.75 ? "Traitor" : "Faithful",
    }));

    setPicks(nextPicks);
    setSealedPicks(Array(DRAFT_SIZE).fill(true));

    if (!predFirstOut) setPredFirstOut(bonusPool[0] ?? "");
    if (!predWinner) setPredWinner(bonusPool[1] ?? "");
    if (traitors.every((entry) => entry === "")) {
      setTraitors([bonusPool[2] ?? "", bonusPool[3] ?? "", bonusPool[4] ?? ""]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Re-resolve against the clock at submit time rather than trusting the
    // rendered snapshot, so a tab opened before the lock cannot submit after it.
    const liveWindow = resolveDraftWindow(gameState, {
      forceClosed: readForceClosedFromEnv(),
    });

    if (!liveWindow.isOpen) {
      setNow(Date.now());
      showToast(
        describeDraftWindow(
          liveWindow,
          gameState.showConfig?.terminology?.draftLabel || "Draft"
        ),
        "warning"
      );
      return;
    }

    if (!playerName.trim() || !playerEmail.trim()) {
      showToast("Name and email are required.", "warning");
      return;
    }

    if (hasDuplicates) {
      showToast("Each draft slot must contain a unique player.", "error");
      return;
    }

    if (!allPicksSealed) {
      showToast("Seal all ten picks before submitting.", "warning");
      return;
    }

    setIsSubmitting(true);

    const newEntry: PlayerEntry = {
      id: Date.now().toString(),
      name: playerName,
      email: playerEmail,
      picks: picks.filter((pick) => pick.member !== ""),
      predFirstOut,
      predWinner,
      predTraitors: traitors.filter((pick) => pick !== ""),
    };

    onAddEntry(newEntry);

    try {
      await submitDraftEntry(newEntry);
      showToast("Draft submitted successfully.", "success");
    } catch (err) {
      logger.warn("Draft submission failed:", err);
      showToast("Submission to server failed. Your entry is still saved locally.", "warning");
    }

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <ConfirmationCard
        playerName={playerName}
        uiVariant={uiVariant}
        onReset={() => {
          setIsSubmitted(false);
          setPlayerName("");
          setPlayerEmail("");
          setPicks(createEmptyPicks());
          setSealedPicks(Array(DRAFT_SIZE).fill(false));
          setPredFirstOut("");
          setPredWinner("");
          setTraitors(["", "", ""]);
        }}
      />
    );
  }

  return (
    <motion.div
      className={`space-y-4 md:space-y-5 pb-8 ${isPremiumUi ? "premium-page premium-draft" : ""}`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className="premium-panel-pad premium-stack-md">
          <PremiumPanelHeader
            kicker="Draft"
            title="Table Builder"
            description="Set ranked picks and role assumptions, then lock and submit with validation."
            rightSlot={
              <div className="flex items-center gap-2">
                <PremiumStatusBadge tone="accent">{sealedCount}/{DRAFT_SIZE} sealed</PremiumStatusBadge>
                <PremiumButton type="button" variant="secondary" onClick={autoGeneratePicks}>
                  Auto Fill
                </PremiumButton>
              </div>
            }
          />
          {isDraftClosed && (
            <div className="premium-inline-alert premium-inline-alert-warning">
              {describeDraftWindow(
                draftWindow,
                gameState.showConfig?.terminology?.draftLabel || "Draft"
              )}
            </div>
          )}
        </PremiumCard>
      </motion.section>

      <motion.form onSubmit={handleSubmit} variants={sectionStaggerVariants}>
        <section className="premium-draft-workspace">
          <motion.div variants={cardRevealVariants}>
            <PremiumCard className="premium-panel-pad-compact premium-stack-sm premium-draft-board">
              <div className="premium-board-head">
                <h3 className="premium-section-title">Draft Board</h3>
                {hasDuplicates && <PremiumStatusBadge tone="negative">Duplicate players selected</PremiumStatusBadge>}
              </div>

              <div className="premium-draft-table">
                <div className="premium-draft-table-head">
                  <span>Slot</span>
                  <span>Cast Member</span>
                  <span className="text-center">Rank</span>
                  <span className="text-center">Role</span>
                  <span className="text-right">Lock</span>
                </div>

                <div className="premium-draft-table-body">
                  {picks.map((pick, index) => {
                    const isDuplicate = pick.member !== "" && duplicateNames.includes(pick.member);
                    const isSealed = sealedPicks[index];
                    const castPortrait = pick.member
                      ? getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl)
                      : undefined;

                    return (
                      <article
                        key={index}
                        className={`premium-draft-row ${
                          isDuplicate ? "premium-draft-row-duplicate" : ""
                        } ${isSealed ? "premium-draft-row-sealed" : ""}`}
                      >
                        <div className="premium-draft-slot-label">#{index + 1}</div>

                        <div className="premium-draft-member-cell">
                          <div className="avatar-ring premium-avatar-xs rounded-full overflow-hidden border border-transparent bg-black/20 flex-shrink-0">
                            {castPortrait ? (
                              <img src={castPortrait} alt={pick.member} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-[color:var(--text)]">
                                {pick.member ? pick.member.charAt(0) : index + 1}
                              </span>
                            )}
                          </div>
                          <CastPicker
                            disabled={isSealed}
                            value={pick.member}
                            onChange={(name) => updatePick(index, "member", name)}
                            options={activeCastOptions}
                            takenNames={picks
                              .map((entry) => entry.member)
                              .filter(Boolean)}
                          />
                        </div>

                        <PremiumField
                          disabled={isSealed}
                          type="number"
                          min="1"
                          max="10"
                          value={pick.rank}
                          onChange={(e) => {
                            const next = Number.parseInt(e.target.value, 10);
                            updatePick(index, "rank", Number.isFinite(next) ? next : 1);
                          }}
                          className="premium-draft-rank-input premium-input-table"
                        />

                        <div className="premium-draft-role-cell">
                          <button
                            type="button"
                            disabled={isSealed}
                            onClick={() => updatePick(index, "role", "Faithful")}
                            className={`premium-segment-btn ${pick.role === "Faithful" ? "premium-segment-btn-on" : ""}`}
                          >
                            Faithful
                          </button>
                          <button
                            type="button"
                            disabled={isSealed}
                            onClick={() => updatePick(index, "role", "Traitor")}
                            className={`premium-segment-btn ${
                              pick.role === "Traitor" ? "premium-segment-btn-on premium-segment-btn-danger" : ""
                            }`}
                          >
                            Traitor
                          </button>
                        </div>

                        <div className="text-right">
                          <PremiumButton
                            type="button"
                            variant="ghost"
                            onClick={() => toggleSeal(index)}
                            className="premium-btn-table w-full"
                          >
                            {isSealed ? "Unlock" : "Lock"}
                          </PremiumButton>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </PremiumCard>
          </motion.div>

          <motion.aside variants={cardRevealVariants}>
            <PremiumCard className="premium-panel-pad-compact premium-stack-sm">
              <section className="space-y-2.5">
                <h3 className="premium-section-title">Submission Profile</h3>
                <PremiumField
                  id="player-name"
                  type="text"
                  placeholder="Player name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  autoComplete="name"
                  className="premium-input-compact"
                />
                <PremiumField
                  id="player-email"
                  type="email"
                  placeholder="Player email"
                  value={playerEmail}
                  onChange={(e) => setPlayerEmail(e.target.value)}
                  autoComplete="email"
                  className="premium-input-compact"
                />
              </section>

              <section className="premium-subpanel space-y-1.5">
                <h3 className="premium-section-title">Validation</h3>
                <div className="premium-divider-list">
                  <div className="premium-row-item premium-row-item-plain">
                    <span className="premium-row-title">All picks selected</span>
                    <PremiumStatusBadge tone={picks.every((pick) => pick.member) ? "positive" : "warning"}>
                      {picks.filter((pick) => pick.member).length}/{DRAFT_SIZE}
                    </PremiumStatusBadge>
                  </div>
                  <div className="premium-row-item premium-row-item-plain">
                    <span className="premium-row-title">Slots locked</span>
                    <PremiumStatusBadge tone={allPicksSealed ? "positive" : "warning"}>
                      {sealedCount}/{DRAFT_SIZE}
                    </PremiumStatusBadge>
                  </div>
                  <div className="premium-row-item premium-row-item-plain">
                    <span className="premium-row-title">Unique picks</span>
                    <PremiumStatusBadge tone={hasDuplicates ? "negative" : "positive"}>
                      {hasDuplicates ? "Fix duplicates" : "Valid"}
                    </PremiumStatusBadge>
                  </div>
                </div>
              </section>

              <section className="space-y-2.5">
                <h3 className="premium-section-title">Consistency Panel</h3>
                <CastPicker
                  value={predFirstOut}
                  onChange={setPredFirstOut}
                  options={activeCastOptions}
                  placeholder="First Out"
                />
                <CastPicker
                  value={predWinner}
                  onChange={setPredWinner}
                  options={activeCastOptions}
                  placeholder="Winner"
                />
                {traitors.map((value, index) => (
                  <CastPicker
                    key={index}
                    value={value}
                    onChange={(name) => {
                      const next = [...traitors];
                      next[index] = name;
                      setTraitors(next);
                    }}
                    options={activeCastOptions}
                    placeholder={`Traitor guess #${index + 1}`}
                    takenNames={traitors.filter(Boolean)}
                  />
                ))}

                <PremiumButton
                  type="submit"
                  variant="primary"
                  disabled={isDraftClosed || hasDuplicates || !allPicksSealed || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting
                    ? "Submitting..."
                    : isDraftClosed
                    ? "Draft Closed"
                    : hasDuplicates
                    ? "Fix Duplicate Picks"
                    : !allPicksSealed
                    ? "Lock All Picks"
                    : "Submit Draft"}
                </PremiumButton>
              </section>
            </PremiumCard>
          </motion.aside>
        </section>
      </motion.form>
    </motion.div>
  );
};

export default DraftForm;
