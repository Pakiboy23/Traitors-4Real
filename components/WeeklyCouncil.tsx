import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CAST_NAMES, COUNCIL_LABELS, GameState, PlayerEntry, UiVariant } from "../types";
import { calculatePlayerScore } from "../src/utils/scoring";
import { useToast } from "./Toast";
import {
  pageRevealVariants,
  sectionStaggerVariants,
} from "../src/ui/motion";
import {
  PremiumButton,
  PremiumCard,
  PremiumField,
  PremiumPanelHeader,
  PremiumSelect,
  PremiumStatusBadge,
  PremiumToggle,
} from "../src/ui/premium";
import { submitGrowthEvent, submitWeeklyCouncilVote } from "../services/pocketbase";

interface WeeklyCouncilProps {
  gameState: GameState;
  onAddEntry: (entry: PlayerEntry) => void;
  uiVariant: UiVariant;
}

const normalize = (value: string) => value.trim().toLowerCase();
const WEEKLY_LABEL = COUNCIL_LABELS.weekly;
const WEEKLY_LABEL_LOWER = WEEKLY_LABEL.toLowerCase();
const JR_LABEL = COUNCIL_LABELS.jr;

const WeeklyCouncil: React.FC<WeeklyCouncilProps> = ({ gameState, onAddEntry, uiVariant }) => {
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";
  const activeCastNames = useMemo(
    () => CAST_NAMES.filter((name) => !gameState.castStatus[name]?.isEliminated),
    [gameState.castStatus]
  );
  const banishedOptions = activeCastNames;
  const murderOptions = ["No Murder", ...activeCastNames];

  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [weeklyBanished, setWeeklyBanished] = useState("");
  const [weeklyMurdered, setWeeklyMurdered] = useState("");
  const [bonusRedemption, setBonusRedemption] = useState("");
  const [bonusDoubleOrNothing, setBonusDoubleOrNothing] = useState(false);
  const [bonusShield, setBonusShield] = useState("");
  const [bonusTrio, setBonusTrio] = useState<string[]>(["", "", ""]);
  const [mainSubmitted, setMainSubmitted] = useState(false);
  const [isMainSubmitting, setIsMainSubmitting] = useState(false);

  const [jrName, setJrName] = useState("");
  const [jrEmail, setJrEmail] = useState("");
  const [jrWeeklyBanished, setJrWeeklyBanished] = useState("");
  const [jrWeeklyMurdered, setJrWeeklyMurdered] = useState("");
  const [jrBonusRedemption, setJrBonusRedemption] = useState("");
  const [jrBonusDoubleOrNothing, setJrBonusDoubleOrNothing] = useState(false);
  const [jrBonusShield, setJrBonusShield] = useState("");
  const [jrBonusTrio, setJrBonusTrio] = useState<string[]>(["", "", ""]);
  const [jrSubmitted, setJrSubmitted] = useState(false);
  const [isJrSubmitting, setIsJrSubmitting] = useState(false);

  const hasBonusSelection = (bonus: {
    redemptionRoulette?: string;
    doubleOrNothing?: boolean;
    shieldGambit?: string;
    traitorTrio?: string[];
  }) =>
    Boolean(
      bonus.redemptionRoulette ||
        bonus.doubleOrNothing ||
        bonus.shieldGambit ||
        bonus.traitorTrio?.some(Boolean)
    );

  const updateTrioPick = (
    picks: string[],
    setPicks: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    const next = [...picks];
    next[index] = value;
    setPicks(next);
  };

  const findExistingPlayer = (league?: "main" | "jr") => {
    if (!playerName && !playerEmail) return undefined;
    const normalizedEmail = normalize(playerEmail);
    const normalizedName = normalize(playerName);

    if (normalizedEmail) {
      const matchByEmail = gameState.players.find((player) => {
        const email = normalize(player.email || "");
        const matchesLeague = league
          ? league === "jr"
            ? player.league === "jr"
            : player.league !== "jr"
          : true;
        return matchesLeague && email && email === normalizedEmail;
      });
      if (matchByEmail) return matchByEmail;
    }

    if (normalizedName) {
      return gameState.players.find((player) => {
        const matchesLeague = league
          ? league === "jr"
            ? player.league === "jr"
            : player.league !== "jr"
          : true;
        return matchesLeague && normalize(player.name) === normalizedName;
      });
    }

    return undefined;
  };

  const findExistingJrPlayer = () => {
    if (!jrName && !jrEmail) return undefined;
    const normalizedEmail = normalize(jrEmail);
    const normalizedName = normalize(jrName);

    if (normalizedEmail) {
      const matchByEmail = gameState.players.find((player) => {
        const email = normalize(player.email || "");
        return player.league === "jr" && email && email === normalizedEmail;
      });
      if (matchByEmail) return matchByEmail;
    }

    if (normalizedName) {
      return gameState.players.find(
        (player) => player.league === "jr" && normalize(player.name) === normalizedName
      );
    }

    return undefined;
  };

  const handleWeeklySubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!playerName || !playerEmail) {
      showToast("Enter name and email before submitting.", "warning");
      return;
    }

    if (
      !weeklyBanished &&
      !weeklyMurdered &&
      !hasBonusSelection({
        redemptionRoulette: bonusRedemption,
        doubleOrNothing: bonusDoubleOrNothing,
        shieldGambit: bonusShield,
        traitorTrio: bonusTrio,
      })
    ) {
      showToast(`Select at least one ${WEEKLY_LABEL_LOWER} or bonus prediction.`, "warning");
      return;
    }

    const existingPlayer = findExistingPlayer("main");
    if (!existingPlayer) {
      showToast("Main league vote requires an existing draft entry.", "error");
      return;
    }

    setMainSubmitted(false);
    setIsMainSubmitting(true);

    const updatedEntry: PlayerEntry = {
      ...existingPlayer,
      name: playerName,
      email: playerEmail,
      weeklyPredictions: {
        weekId: gameState.activeWeekId,
        nextBanished: weeklyBanished,
        nextMurdered: weeklyMurdered,
        bonusGames: {
          redemptionRoulette: bonusRedemption,
          doubleOrNothing: bonusDoubleOrNothing,
          shieldGambit: bonusShield,
          traitorTrio: bonusTrio.filter(Boolean),
        },
      },
    };

    onAddEntry(updatedEntry);

    try {
      await submitWeeklyCouncilVote({
        name: playerName,
        email: playerEmail,
        weeklyPredictions: {
          nextBanished: weeklyBanished,
          nextMurdered: weeklyMurdered,
        },
        weekId: gameState.activeWeekId,
        bonusGames: {
          redemptionRoulette: bonusRedemption,
          doubleOrNothing: bonusDoubleOrNothing,
          shieldGambit: bonusShield,
          traitorTrio: bonusTrio.filter(Boolean),
        },
        league: "main",
      });
      showToast(`${WEEKLY_LABEL} submitted.`, "success");
      setMainSubmitted(true);
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Submission failed. Please try again.";
      console.warn(`${WEEKLY_LABEL} submission failed:`, err);
      showToast(message, "error");
    } finally {
      setIsMainSubmitting(false);
    }
  };

  const handleJrWeeklySubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!jrName || !jrEmail) {
      showToast(`Enter name and email before submitting ${JR_LABEL} picks.`, "warning");
      return;
    }

    if (
      !jrWeeklyBanished &&
      !jrWeeklyMurdered &&
      !hasBonusSelection({
        redemptionRoulette: jrBonusRedemption,
        doubleOrNothing: jrBonusDoubleOrNothing,
        shieldGambit: jrBonusShield,
        traitorTrio: jrBonusTrio,
      })
    ) {
      showToast(`Select at least one ${WEEKLY_LABEL_LOWER} or bonus prediction.`, "warning");
      return;
    }

    const jrWeeklyPrediction = {
      nextBanished: jrWeeklyBanished,
      nextMurdered: jrWeeklyMurdered,
    };
    const jrBonusPrediction = {
      redemptionRoulette: jrBonusRedemption,
      doubleOrNothing: jrBonusDoubleOrNothing,
      shieldGambit: jrBonusShield,
      traitorTrio: jrBonusTrio.filter(Boolean),
    };

    const existingJrPlayer = findExistingJrPlayer();
    const fallbackId =
      normalize(jrEmail) ||
      normalize(jrName).replace(/\s+/g, "-") ||
      `jr-player-${Date.now()}`;
    const updatedJrEntry: PlayerEntry = {
      ...(existingJrPlayer ?? {
        id: fallbackId,
        picks: [],
        predFirstOut: "",
        predWinner: "",
        predTraitors: [],
      }),
      name: jrName,
      email: jrEmail,
      league: "jr",
      weeklyPredictions: {
        ...jrWeeklyPrediction,
        bonusGames: jrBonusPrediction,
      },
    };

    onAddEntry(updatedJrEntry);

    setJrSubmitted(false);
    setIsJrSubmitting(true);

    try {
      await submitWeeklyCouncilVote({
        name: jrName,
        email: jrEmail,
        weeklyPredictions: jrWeeklyPrediction,
        weekId: gameState.activeWeekId,
        bonusGames: jrBonusPrediction,
        league: "jr",
      });
      showToast(`${JR_LABEL} vote submitted.`, "success");
      setJrSubmitted(true);
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Submission failed. Please try again.";
      console.warn(`${JR_LABEL} submission failed:`, err);
      showToast(message, "error");
    } finally {
      setIsJrSubmitting(false);
    }
  };

  const handleShareInvite = async (league: "main" | "jr", name: string, email: string) => {
    const params = new URLSearchParams({
      tab: "weekly",
      league,
      ref: name || "league-member",
    });

    if (isPremiumUi) {
      params.set("ui", "premium");
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const shareText = `${name || "A league member"} submitted picks in Traitors Fantasy. Lock yours in now.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Traitors Fantasy: Weekly Picks",
          text: shareText,
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      } else {
        throw new Error("Clipboard unavailable");
      }

      showToast("Invite link ready to share.", "success");
      await submitGrowthEvent({
        event: "invite_share_clicked",
        name,
        email,
        payload: { league, ref: name || "league-member" },
      });
    } catch (error) {
      console.warn("Invite share failed:", error);
      showToast("Unable to share link on this device.", "warning");
    }
  };

  const mainPlayerMatch = findExistingPlayer("main");
  const mainScoreTotal = mainPlayerMatch ? calculatePlayerScore(gameState, mainPlayerMatch).total : null;
  const hasMainDouble = mainScoreTotal !== null && mainScoreTotal < 0;

  const jrPlayerMatch = findExistingJrPlayer();
  const jrScoreTotal = jrPlayerMatch ? calculatePlayerScore(gameState, jrPlayerMatch).total : null;
  const hasJrDouble = jrScoreTotal !== null && jrScoreTotal < 0;

  return (
    <motion.div
      className={`space-y-4 md:space-y-5 ${isPremiumUi ? "premium-page premium-weekly" : ""}`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className="premium-panel-pad">
          <PremiumPanelHeader
            kicker="Weekly"
            title="Decision Desk"
            description="Main Council is for players who completed the full season-opening draft. Jr Council is for players who skipped the opening draft and only submit weekly predictions."
            rightSlot={<PremiumStatusBadge tone="accent">Main + Jr</PremiumStatusBadge>}
          />
        </PremiumCard>
      </motion.section>

      <motion.section className="premium-weekly-workspace" variants={sectionStaggerVariants}>
        <PremiumCard className="premium-panel-pad premium-decision-board">
          <p className="premium-meta-line">
            <strong>Main Council</strong> is your primary entry for the season leaderboard. <strong>Jr. Council</strong> is a
            separate side entry for the rival you invite, tracked independently with the same weekly questions.
          </p>

          <section className="premium-decision-league">
            <div className="premium-section-topline">
              <h3 className="premium-section-title">{WEEKLY_LABEL}</h3>
              <PremiumStatusBadge tone={mainSubmitted ? "positive" : "neutral"}>
                {mainSubmitted ? "Submitted" : "Open"}
              </PremiumStatusBadge>
            </div>
            <p className="premium-meta-line mt-2">
              For drafted players: you completed the season-opening draft and now submit weekly
              calls here.
            </p>

            <div className="premium-inline-grid mt-3">
              <PremiumField
                type="text"
                placeholder="Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <PremiumField
                type="email"
                placeholder="Email"
                value={playerEmail}
                onChange={(e) => setPlayerEmail(e.target.value)}
              />
              <PremiumSelect
                value={weeklyBanished}
                onChange={(e) => setWeeklyBanished(e.target.value)}
                aria-label="Main next banished"
              >
                <option value="">Next Banished</option>
                {banishedOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
              <PremiumSelect
                value={weeklyMurdered}
                onChange={(e) => setWeeklyMurdered(e.target.value)}
                aria-label="Main next murdered"
              >
                <option value="">Next Murdered</option>
                {murderOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
            </div>

            <div className="premium-inline-grid mt-3">
              <PremiumSelect value={bonusRedemption} onChange={(e) => setBonusRedemption(e.target.value)}>
                <option value="">Redemption Roulette</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
              <PremiumSelect value={bonusShield} onChange={(e) => setBonusShield(e.target.value)}>
                <option value="">Shield Gambit</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
              <PremiumToggle
                label="Double or Nothing"
                checked={bonusDoubleOrNothing}
                onChange={setBonusDoubleOrNothing}
              />
              <div className="grid grid-cols-3 gap-2">
                {bonusTrio.map((pick, index) => (
                  <PremiumSelect
                    key={`main-trio-${index}`}
                    value={pick}
                    onChange={(e) => updateTrioPick(bonusTrio, setBonusTrio, index, e.target.value)}
                    aria-label={`Main traitor trio pick ${index + 1}`}
                  >
                    <option value="">Trio {index + 1}</option>
                    {activeCastNames.map((name) => (
                      <option key={`main-trio-${index}-${name}`} value={name}>
                        {name}
                      </option>
                    ))}
                  </PremiumSelect>
                ))}
              </div>
            </div>

            <div className="premium-action-row mt-3">
              <PremiumStatusBadge tone={hasMainDouble ? "positive" : "warning"}>
                {hasMainDouble ? "2x Active" : "2x Locked"}
              </PremiumStatusBadge>
              <div className="flex items-center gap-2">
                {mainSubmitted && (
                  <PremiumButton
                    type="button"
                    variant="secondary"
                    onClick={() => handleShareInvite("main", playerName, playerEmail)}
                  >
                    Invite Rival
                  </PremiumButton>
                )}
                <PremiumButton
                  type="button"
                  variant="primary"
                  onClick={handleWeeklySubmit}
                  disabled={isMainSubmitting}
                >
                  {isMainSubmitting ? "Submitting..." : `Submit ${WEEKLY_LABEL}`}
                </PremiumButton>
              </div>
            </div>
          </section>

          <section className="premium-decision-league premium-decision-league-divider">
            <div className="premium-section-topline">
              <h3 className="premium-section-title">{JR_LABEL}</h3>
              <PremiumStatusBadge tone={jrSubmitted ? "positive" : "neutral"}>
                {jrSubmitted ? "Submitted" : "Open"}
              </PremiumStatusBadge>
            </div>
            <p className="premium-meta-line mt-2">
              For weekly-only players: you did not complete the season-opening draft and only
              submit weekly predictions here.
            </p>

            <div className="premium-inline-grid mt-3">
              <PremiumField
                type="text"
                placeholder="Name"
                value={jrName}
                onChange={(e) => setJrName(e.target.value)}
              />
              <PremiumField
                type="email"
                placeholder="Email"
                value={jrEmail}
                onChange={(e) => setJrEmail(e.target.value)}
              />
              <PremiumSelect
                value={jrWeeklyBanished}
                onChange={(e) => setJrWeeklyBanished(e.target.value)}
                aria-label="Jr next banished"
              >
                <option value="">Next Banished</option>
                {banishedOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
              <PremiumSelect
                value={jrWeeklyMurdered}
                onChange={(e) => setJrWeeklyMurdered(e.target.value)}
                aria-label="Jr next murdered"
              >
                <option value="">Next Murdered</option>
                {murderOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
            </div>

            <div className="premium-inline-grid mt-3">
              <PremiumSelect value={jrBonusRedemption} onChange={(e) => setJrBonusRedemption(e.target.value)}>
                <option value="">Redemption Roulette</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
              <PremiumSelect value={jrBonusShield} onChange={(e) => setJrBonusShield(e.target.value)}>
                <option value="">Shield Gambit</option>
                {activeCastNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </PremiumSelect>
              <PremiumToggle
                label="Double or Nothing"
                checked={jrBonusDoubleOrNothing}
                onChange={setJrBonusDoubleOrNothing}
              />
              <div className="grid grid-cols-3 gap-2">
                {jrBonusTrio.map((pick, index) => (
                  <PremiumSelect
                    key={`jr-trio-${index}`}
                    value={pick}
                    onChange={(e) => updateTrioPick(jrBonusTrio, setJrBonusTrio, index, e.target.value)}
                    aria-label={`Jr traitor trio pick ${index + 1}`}
                  >
                    <option value="">Trio {index + 1}</option>
                    {activeCastNames.map((name) => (
                      <option key={`jr-trio-${index}-${name}`} value={name}>
                        {name}
                      </option>
                    ))}
                  </PremiumSelect>
                ))}
              </div>
            </div>

            <div className="premium-action-row mt-3">
              <PremiumStatusBadge tone={hasJrDouble ? "positive" : "warning"}>
                {hasJrDouble ? "2x Active" : "2x Locked"}
              </PremiumStatusBadge>
              <div className="flex items-center gap-2">
                {jrSubmitted && (
                  <PremiumButton
                    type="button"
                    variant="secondary"
                    onClick={() => handleShareInvite("jr", jrName, jrEmail)}
                  >
                    Invite Rival
                  </PremiumButton>
                )}
                <PremiumButton
                  type="button"
                  variant="primary"
                  onClick={handleJrWeeklySubmit}
                  disabled={isJrSubmitting}
                >
                  {isJrSubmitting ? "Submitting..." : `Submit ${JR_LABEL}`}
                </PremiumButton>
              </div>
            </div>
          </section>
        </PremiumCard>

        <aside>
          <PremiumCard className="premium-panel-pad premium-stack-md">
            <section>
              <div className="premium-section-topline">
                <h3 className="premium-section-title">Shared Bonus Logic</h3>
                <PremiumStatusBadge tone="accent">Rules</PremiumStatusBadge>
              </div>
              <div className="premium-divider-list mt-3">
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">Redemption Roulette</p>
                    <p className="premium-meta-line">Correct +8, incorrect -1.</p>
                  </div>
                </article>
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">Double or Nothing</p>
                    <p className="premium-meta-line">2x multiplier on weekly banished and murdered calls.</p>
                  </div>
                </article>
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">Shield + Traitor Trio</p>
                    <p className="premium-meta-line">Shield pick plus three-person traitor shortlist.</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="premium-subpanel">
              <div className="premium-section-topline">
                <h3 className="premium-section-title">Submission State</h3>
                <PremiumStatusBadge>
                  {mainSubmitted || jrSubmitted ? "In cycle" : "No submissions"}
                </PremiumStatusBadge>
              </div>
              <div className="premium-divider-list mt-3">
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">Main League</p>
                    <p className="premium-meta-line">
                      Season-opening draft completed; weekly picks active.
                    </p>
                  </div>
                  <PremiumStatusBadge tone={mainSubmitted ? "positive" : "warning"}>
                    {mainSubmitted ? "Submitted" : "Pending"}
                  </PremiumStatusBadge>
                </article>
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">Jr League</p>
                    <p className="premium-meta-line">
                      No season-opening draft; weekly predictions only.
                    </p>
                  </div>
                  <PremiumStatusBadge tone={jrSubmitted ? "positive" : "warning"}>
                    {jrSubmitted ? "Submitted" : "Pending"}
                  </PremiumStatusBadge>
                </article>
              </div>
            </section>
          </PremiumCard>
        </aside>
      </motion.section>
    </motion.div>
  );
};

export default WeeklyCouncil;
