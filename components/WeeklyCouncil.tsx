import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  COUNCIL_LABELS,
  FinalePredictions,
  GameState,
  PlayerEntry,
  ShowConfig,
  UiVariant,
} from "../types";
import { calculatePlayerScore } from "../src/utils/scoring";
import { logger } from "../src/utils/logger";
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
  showConfig?: ShowConfig;
  uiVariant: UiVariant;
}

const normalize = (value: string) => value.trim().toLowerCase();
const FINALE_CONFETTI_COUNT = 16;
const FINALE_VIEWPORT_CONFETTI_COUNT = 30;
const buildDefaultLockAt = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const WeeklyCouncil: React.FC<WeeklyCouncilProps> = ({
  gameState,
  onAddEntry,
  showConfig,
  uiVariant,
}) => {
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";
  const seasonStatus = gameState.seasonConfig?.status;
  const isSeasonReadOnly =
    seasonStatus === "finalized" || seasonStatus === "archived";
  const WEEKLY_LABEL =
    showConfig?.terminology?.weeklyCouncilLabel || COUNCIL_LABELS.weekly;
  const WEEKLY_LABEL_LOWER = WEEKLY_LABEL.toLowerCase();
  const JR_LABEL = showConfig?.terminology?.jrCouncilLabel || COUNCIL_LABELS.jr;
  const isFinaleMode = Boolean(gameState.finaleConfig?.enabled);
  const finaleLabel =
    typeof gameState.finaleConfig?.label === "string" && gameState.finaleConfig.label.trim()
      ? gameState.finaleConfig.label
      : showConfig?.terminology?.finaleLabelDefault || "Finale Gauntlet";
  const finaleLockAt = gameState.finaleConfig?.lockAt || buildDefaultLockAt();
  const finaleLockLabel = Number.isNaN(Date.parse(finaleLockAt))
    ? finaleLockAt
    : new Date(finaleLockAt).toLocaleString();
  const castNames = Object.keys(gameState.castStatus || {}).sort((a, b) =>
    a.localeCompare(b)
  );
  const activeCastNames = useMemo(
    () => castNames.filter((name) => !gameState.castStatus[name]?.isEliminated),
    [castNames, gameState.castStatus]
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
  const [mainFinalWinner, setMainFinalWinner] = useState("");
  const [mainLastFaithful, setMainLastFaithful] = useState("");
  const [mainLastTraitor, setMainLastTraitor] = useState("");
  const [mainFinalPotEstimate, setMainFinalPotEstimate] = useState("");
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
  const [jrFinalWinner, setJrFinalWinner] = useState("");
  const [jrLastFaithful, setJrLastFaithful] = useState("");
  const [jrLastTraitor, setJrLastTraitor] = useState("");
  const [jrFinalPotEstimate, setJrFinalPotEstimate] = useState("");
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

  const toFinalePredictions = (
    values: {
      finalWinner: string;
      lastFaithfulStanding: string;
      lastTraitorStanding: string;
      finalPotEstimateRaw: string;
    },
    fallback?: FinalePredictions
  ): FinalePredictions => {
    const parsedPot = Number(values.finalPotEstimateRaw);
    const finalPotEstimate =
      values.finalPotEstimateRaw.trim().length > 0 && Number.isFinite(parsedPot)
        ? parsedPot
        : null;

    return {
      finalWinner: values.finalWinner || fallback?.finalWinner || "",
      lastFaithfulStanding:
        values.lastFaithfulStanding || fallback?.lastFaithfulStanding || "",
      lastTraitorStanding:
        values.lastTraitorStanding || fallback?.lastTraitorStanding || "",
      finalPotEstimate,
    };
  };

  const hasCompleteFinalePrediction = (prediction: FinalePredictions) =>
    Boolean(
      prediction.finalWinner &&
        prediction.lastFaithfulStanding &&
        prediction.lastTraitorStanding &&
        typeof prediction.finalPotEstimate === "number" &&
        Number.isFinite(prediction.finalPotEstimate)
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
    if (isSeasonReadOnly) {
      showToast("This season is locked. Submissions are disabled.", "warning");
      return;
    }

    if (!playerName || !playerEmail) {
      showToast("Enter name and email before submitting.", "warning");
      return;
    }

    const mainFinalePrediction = toFinalePredictions({
      finalWinner: mainFinalWinner,
      lastFaithfulStanding: mainLastFaithful,
      lastTraitorStanding: mainLastTraitor,
      finalPotEstimateRaw: mainFinalPotEstimate,
    });

    if (isFinaleMode) {
      if (!weeklyBanished && !weeklyMurdered) {
        showToast(`Select at least one ${WEEKLY_LABEL_LOWER} prediction.`, "warning");
        return;
      }
      if (!hasCompleteFinalePrediction(mainFinalePrediction)) {
        showToast("Complete all finale fields before submitting.", "warning");
        return;
      }
    } else if (
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
          doubleOrNothing: isFinaleMode ? false : bonusDoubleOrNothing,
          shieldGambit: bonusShield,
          traitorTrio: bonusTrio.filter(Boolean),
        },
        finalePredictions: isFinaleMode
          ? mainFinalePrediction
          : existingPlayer.weeklyPredictions?.finalePredictions,
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
        seasonId: gameState.seasonId,
        rulePackId: gameState.rulePackId,
        bonusGames: {
          redemptionRoulette: bonusRedemption,
          doubleOrNothing: isFinaleMode ? false : bonusDoubleOrNothing,
          shieldGambit: bonusShield,
          traitorTrio: bonusTrio.filter(Boolean),
        },
        finalePredictions: isFinaleMode ? mainFinalePrediction : undefined,
        league: "main",
      });
      showToast(`${WEEKLY_LABEL} submitted.`, "success");
      setMainSubmitted(true);
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Submission failed. Please try again.";
      logger.warn(`${WEEKLY_LABEL} submission failed:`, err);
      showToast(message, "error");
    } finally {
      setIsMainSubmitting(false);
    }
  };

  const handleJrWeeklySubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isSeasonReadOnly) {
      showToast("This season is locked. Submissions are disabled.", "warning");
      return;
    }

    if (!jrName || !jrEmail) {
      showToast(`Enter name and email before submitting ${JR_LABEL} picks.`, "warning");
      return;
    }

    const jrFinalePrediction = toFinalePredictions({
      finalWinner: jrFinalWinner,
      lastFaithfulStanding: jrLastFaithful,
      lastTraitorStanding: jrLastTraitor,
      finalPotEstimateRaw: jrFinalPotEstimate,
    });

    if (isFinaleMode) {
      if (!jrWeeklyBanished && !jrWeeklyMurdered) {
        showToast(`Select at least one ${WEEKLY_LABEL_LOWER} prediction.`, "warning");
        return;
      }
      if (!hasCompleteFinalePrediction(jrFinalePrediction)) {
        showToast("Complete all finale fields before submitting.", "warning");
        return;
      }
    } else if (
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
      doubleOrNothing: isFinaleMode ? false : jrBonusDoubleOrNothing,
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
        weekId: gameState.activeWeekId,
        ...jrWeeklyPrediction,
        bonusGames: jrBonusPrediction,
        finalePredictions: isFinaleMode
          ? jrFinalePrediction
          : existingJrPlayer?.weeklyPredictions?.finalePredictions,
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
        seasonId: gameState.seasonId,
        rulePackId: gameState.rulePackId,
        bonusGames: jrBonusPrediction,
        finalePredictions: isFinaleMode ? jrFinalePrediction : undefined,
        league: "jr",
      });
      showToast(`${JR_LABEL} vote submitted.`, "success");
      setJrSubmitted(true);
    } catch (err) {
      const message =
        typeof (err as Error)?.message === "string" && (err as Error).message.length
          ? (err as Error).message
          : "Submission failed. Please try again.";
      logger.warn(`${JR_LABEL} submission failed:`, err);
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
    const shareText = `${
      name || "A league member"
    } submitted picks in ${showConfig?.shortName || "Traitors Fantasy"}. Lock yours in now.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${showConfig?.shortName || "Traitors Fantasy"}: Weekly Picks`,
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
      logger.warn("Invite share failed:", error);
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
      className={`space-y-4 md:space-y-5 ${isPremiumUi ? "premium-page premium-weekly" : ""} ${
        isFinaleMode ? "premium-finale-page" : ""
      }`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      {isFinaleMode && (
        <div className="premium-finale-viewport-fx" aria-hidden="true">
          <span className="premium-finale-viewport-beam premium-finale-viewport-beam-a" />
          <span className="premium-finale-viewport-beam premium-finale-viewport-beam-b" />
          {!reduceMotion &&
            Array.from({ length: FINALE_VIEWPORT_CONFETTI_COUNT }).map((_, idx) => (
              <span
                key={`viewport-confetti-${idx}`}
                className="premium-finale-viewport-piece"
                style={
                  {
                    "--viewport-left": `${2 + ((idx * 73) % 96)}%`,
                    "--viewport-delay": `${(idx % 12) * 0.16}s`,
                    "--viewport-duration": `${3.9 + (idx % 7) * 0.38}s`,
                    "--viewport-hue": `${(idx * 29) % 360}`,
                  } as React.CSSProperties
                }
              />
            ))}
        </div>
      )}

      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className={`premium-panel-pad ${isFinaleMode ? "premium-finale-command-card" : ""}`}>
          <PremiumPanelHeader
            kicker="Weekly"
            title={isFinaleMode ? "Finale Gauntlet Command Deck" : "Decision Desk"}
            description={
              isFinaleMode
                ? "Finale Gauntlet is live. Main and Jr players submit weighted finale predictions this week."
                : "Main Council is for players who completed the full season-opening draft. Jr Council is for players who skipped the opening draft and only submit weekly predictions."
            }
            rightSlot={
              <PremiumStatusBadge tone="accent">
                {isFinaleMode ? "Live Finale Mode" : "Main + Jr"}
              </PremiumStatusBadge>
            }
          />
        </PremiumCard>
      </motion.section>

      {isFinaleMode && (
        <motion.section className="premium-finale-siren" variants={sectionStaggerVariants}>
          <div className="premium-finale-siren-inner">
            <p className="premium-finale-siren-kicker">Finale Window Is Live</p>
            <h2 className="premium-finale-siren-title">{finaleLabel}</h2>
            <p className="premium-finale-siren-sub">
              One night. Weighted scoring. Champion crowned.
            </p>
          </div>
        </motion.section>
      )}

      <motion.section
        className={`premium-weekly-workspace ${
          isFinaleMode ? "premium-weekly-workspace-finale" : ""
        }`}
        variants={sectionStaggerVariants}
      >
        <PremiumCard
          className={`premium-panel-pad premium-decision-board ${
            isFinaleMode ? "premium-finale-board" : ""
          }`}
        >
          <p className="premium-meta-line">
            {isFinaleMode ? (
              <>
                <strong>{finaleLabel}</strong> lock time is set to{" "}
                <strong>{finaleLockLabel}</strong>. Main and Jr entries both
                run through the same finale rules and tie-break.
              </>
            ) : (
              <>
                <strong>Main Council</strong> is your primary entry for the season leaderboard.{" "}
                <strong>Jr. Council</strong> is a separate side entry for the rival you invite, tracked
                independently with the same weekly questions.
              </>
            )}
          </p>

          {isFinaleMode && (
            <section className="premium-finale-hero" aria-live="polite">
              <div className="premium-finale-confetti" aria-hidden="true">
                {Array.from({ length: FINALE_CONFETTI_COUNT }).map((_, idx) => (
                  <span
                    key={`finale-confetti-${idx}`}
                    className="premium-finale-confetti-piece"
                    style={
                      {
                        "--piece-left": `${3 + ((idx * 97) % 90)}%`,
                        "--piece-delay": `${(idx % 6) * 0.22}s`,
                        "--piece-duration": `${3.5 + (idx % 5) * 0.34}s`,
                        "--piece-hue": `${(idx * 37) % 360}`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              <p className="premium-finale-hero-kicker">Season Finale Activated</p>
              <h2 className="premium-finale-hero-title">{finaleLabel}</h2>
              <p className="premium-finale-hero-copy">
                Bold calls only. Weighted scoring. One explosive night decides the crown.
              </p>
            </section>
          )}

          <section className="premium-decision-league">
            <div className="premium-section-topline">
              <h3 className="premium-section-title">{WEEKLY_LABEL}</h3>
              <PremiumStatusBadge tone={mainSubmitted ? "positive" : "neutral"}>
                {mainSubmitted ? "Submitted" : "Open"}
              </PremiumStatusBadge>
            </div>
            <p className="premium-meta-line mt-2">
              {isFinaleMode
                ? "For drafted players: submit your weekly calls plus the full finale prediction set."
                : "For drafted players: you completed the season-opening draft and now submit weekly calls here."}
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

            {isFinaleMode && (
              <div className="premium-inline-grid mt-3">
                <PremiumSelect
                  value={mainFinalWinner}
                  onChange={(e) => setMainFinalWinner(e.target.value)}
                  aria-label="Main final winner"
                >
                  <option value="">Final Winner</option>
                  {activeCastNames.map((name) => (
                    <option key={`main-finale-winner-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </PremiumSelect>
                <PremiumSelect
                  value={mainLastFaithful}
                  onChange={(e) => setMainLastFaithful(e.target.value)}
                  aria-label="Main last faithful standing"
                >
                  <option value="">Last Faithful Standing</option>
                  {activeCastNames.map((name) => (
                    <option key={`main-finale-faithful-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </PremiumSelect>
                <PremiumSelect
                  value={mainLastTraitor}
                  onChange={(e) => setMainLastTraitor(e.target.value)}
                  aria-label="Main last traitor standing"
                >
                  <option value="">Last Traitor Standing</option>
                  {activeCastNames.map((name) => (
                    <option key={`main-finale-traitor-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </PremiumSelect>
                <PremiumField
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Final Pot Estimate"
                  value={mainFinalPotEstimate}
                  onChange={(e) => setMainFinalPotEstimate(e.target.value)}
                />
              </div>
            )}

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
              {!isFinaleMode ? (
                <PremiumToggle
                  label="Double or Nothing"
                  checked={bonusDoubleOrNothing}
                  onChange={setBonusDoubleOrNothing}
                />
              ) : (
                <div className="premium-row-item premium-row-item-plain">
                  <p className="premium-meta-line">Double or Nothing disabled in finale mode.</p>
                </div>
              )}
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
              <PremiumStatusBadge tone={isFinaleMode ? "accent" : hasMainDouble ? "positive" : "warning"}>
                {isFinaleMode ? "Finale Rules" : hasMainDouble ? "2x Active" : "2x Locked"}
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
                  disabled={isMainSubmitting || isSeasonReadOnly}
                  className={isFinaleMode ? "premium-finale-submit-btn" : ""}
                >
                  {isSeasonReadOnly
                    ? "Season Locked"
                    : isMainSubmitting
                    ? "Submitting..."
                    : `Submit ${WEEKLY_LABEL}`}
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
              {isFinaleMode
                ? "For weekly-only players: submit weekly calls plus full finale predictions for this week."
                : "For weekly-only players: you did not complete the season-opening draft and only submit weekly predictions here."}
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

            {isFinaleMode && (
              <div className="premium-inline-grid mt-3">
                <PremiumSelect
                  value={jrFinalWinner}
                  onChange={(e) => setJrFinalWinner(e.target.value)}
                  aria-label="Jr final winner"
                >
                  <option value="">Final Winner</option>
                  {activeCastNames.map((name) => (
                    <option key={`jr-finale-winner-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </PremiumSelect>
                <PremiumSelect
                  value={jrLastFaithful}
                  onChange={(e) => setJrLastFaithful(e.target.value)}
                  aria-label="Jr last faithful standing"
                >
                  <option value="">Last Faithful Standing</option>
                  {activeCastNames.map((name) => (
                    <option key={`jr-finale-faithful-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </PremiumSelect>
                <PremiumSelect
                  value={jrLastTraitor}
                  onChange={(e) => setJrLastTraitor(e.target.value)}
                  aria-label="Jr last traitor standing"
                >
                  <option value="">Last Traitor Standing</option>
                  {activeCastNames.map((name) => (
                    <option key={`jr-finale-traitor-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </PremiumSelect>
                <PremiumField
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Final Pot Estimate"
                  value={jrFinalPotEstimate}
                  onChange={(e) => setJrFinalPotEstimate(e.target.value)}
                />
              </div>
            )}

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
              {!isFinaleMode ? (
                <PremiumToggle
                  label="Double or Nothing"
                  checked={jrBonusDoubleOrNothing}
                  onChange={setJrBonusDoubleOrNothing}
                />
              ) : (
                <div className="premium-row-item premium-row-item-plain">
                  <p className="premium-meta-line">Double or Nothing disabled in finale mode.</p>
                </div>
              )}
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
              <PremiumStatusBadge tone={isFinaleMode ? "accent" : hasJrDouble ? "positive" : "warning"}>
                {isFinaleMode ? "Finale Rules" : hasJrDouble ? "2x Active" : "2x Locked"}
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
                  disabled={isJrSubmitting || isSeasonReadOnly}
                  className={isFinaleMode ? "premium-finale-submit-btn" : ""}
                >
                  {isSeasonReadOnly
                    ? "Season Locked"
                    : isJrSubmitting
                    ? "Submitting..."
                    : `Submit ${JR_LABEL}`}
                </PremiumButton>
              </div>
            </div>
          </section>
        </PremiumCard>

        <aside className={isFinaleMode ? "premium-finale-aside" : ""}>
          <PremiumCard
            className={`premium-panel-pad premium-stack-md ${
              isFinaleMode ? "premium-finale-rules-card" : ""
            }`}
          >
            <section>
              <div className="premium-section-topline">
                <h3 className="premium-section-title">
                  {isFinaleMode ? "Finale Scoring Logic" : "Shared Bonus Logic"}
                </h3>
                <PremiumStatusBadge tone="accent">
                  {isFinaleMode ? "Weighted Week" : "Rules"}
                </PremiumStatusBadge>
              </div>
              <div className="premium-divider-list mt-3">
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">
                      {isFinaleMode ? "Weekly Calls (Weighted)" : "Redemption Roulette"}
                    </p>
                    <p className="premium-meta-line">
                      {isFinaleMode
                        ? "Banished/Murdered are worth +4 each, with -1 on incorrect calls."
                        : "Correct +8, incorrect -1."}
                    </p>
                  </div>
                </article>
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">
                      {isFinaleMode ? "Finale Picks" : "Double or Nothing"}
                    </p>
                    <p className="premium-meta-line">
                      {isFinaleMode
                        ? "Final Winner +15, Last Faithful +8, Last Traitor +8."
                        : "2x multiplier on weekly banished and murdered calls."}
                    </p>
                  </div>
                </article>
                <article className="premium-row-item premium-row-item-plain">
                  <div>
                    <p className="premium-row-title">
                      {isFinaleMode ? "Tie-Break" : "Shield + Traitor Trio"}
                    </p>
                    <p className="premium-meta-line">
                      {isFinaleMode
                        ? "Closest final pot estimate wins tied totals."
                        : "Shield pick plus three-person traitor shortlist."}
                    </p>
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
                      {isFinaleMode
                        ? "Season-opening draft completed; finale gauntlet picks active."
                        : "Season-opening draft completed; weekly picks active."}
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
                      {isFinaleMode
                        ? "No season-opening draft; finale gauntlet predictions active."
                        : "No season-opening draft; weekly predictions only."}
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
