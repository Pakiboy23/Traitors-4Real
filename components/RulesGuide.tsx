import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GameState, UiVariant } from "../types";
import { getRulePackById } from "../src/config/rulePacks";
import { buildRulesGuide, formatRulePoints } from "../src/utils/rulesGuide";
import {
  cardRevealVariants,
  pageRevealVariants,
  sectionStaggerVariants,
} from "../src/ui/motion";
import {
  PremiumCard,
  PremiumPanelHeader,
  PremiumStatusBadge,
} from "../src/ui/premium";

interface RulesGuideProps {
  gameState: GameState;
  uiVariant: UiVariant;
}

/**
 * The scoring guide players read before drafting.
 *
 * Every rule and number here is derived from the active rule pack, so the guide
 * cannot drift from the engine that awards the points.
 */
const RulesGuide: React.FC<RulesGuideProps> = ({ gameState, uiVariant }) => {
  const reduceMotion = useReducedMotion();
  const isPremiumUi = uiVariant === "premium";

  const guide = useMemo(() => {
    const pack = getRulePackById(
      gameState.rulePackId ?? gameState.seasonConfig?.rulePackId
    );
    return buildRulesGuide(pack);
  }, [gameState.rulePackId, gameState.seasonConfig?.rulePackId]);

  const draftLabel = gameState.showConfig?.terminology?.draftLabel || "Draft";

  return (
    <motion.div
      className={`space-y-4 md:space-y-5 pb-8 ${isPremiumUi ? "premium-page" : ""}`}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={pageRevealVariants}
    >
      <motion.section variants={sectionStaggerVariants}>
        <PremiumCard className="premium-panel-pad premium-stack-md">
          <PremiumPanelHeader
            kicker="How to play"
            title="Scoring Guide"
            description={
              guide.packDescription ||
              `Everything that earns or costs points, straight from the rules this season runs on.`
            }
            rightSlot={
              <PremiumStatusBadge tone="accent">{guide.packName}</PremiumStatusBadge>
            }
          />
          <p className="text-sm opacity-80 leading-relaxed">
            Your score is the sum of three things: a one-off {draftLabel.toLowerCase()} you
            set before the season, a call you make each week, and any bonus games you
            choose to play. Every number below comes from this season&rsquo;s rules, so
            what you read here is exactly what the scoreboard uses.
          </p>
        </PremiumCard>
      </motion.section>

      {guide.sections.map((section) => (
        <motion.section key={section.id} variants={sectionStaggerVariants}>
          <motion.div variants={cardRevealVariants}>
            <PremiumCard className="premium-panel-pad premium-stack-sm">
              <div className="premium-board-head">
                <h3 className="premium-section-title">{section.title}</h3>
                <PremiumStatusBadge tone="neutral">
                  {section.entries.length} {section.entries.length === 1 ? "rule" : "rules"}
                </PremiumStatusBadge>
              </div>
              <p className="text-sm opacity-75 leading-relaxed">{section.blurb}</p>

              <ul className="premium-stack-sm list-none p-0 m-0">
                {section.entries.map((entry) => (
                  <li
                    key={entry.key}
                    className="flex items-start justify-between gap-4 border-t border-white/10 pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{entry.label}</div>
                      <div className="text-[13px] opacity-70 leading-relaxed">
                        {entry.detail}
                      </div>
                    </div>
                    <PremiumStatusBadge
                      tone={entry.tone === "gain" ? "positive" : "negative"}
                    >
                      {formatRulePoints(entry.points)}
                    </PremiumStatusBadge>
                  </li>
                ))}
              </ul>
            </PremiumCard>
          </motion.div>
        </motion.section>
      ))}

      <motion.section variants={sectionStaggerVariants}>
        <motion.div variants={cardRevealVariants}>
          <PremiumCard className="premium-panel-pad premium-stack-sm">
            <h3 className="premium-section-title">Worth knowing</h3>
            <ul className="premium-stack-sm list-disc pl-5 m-0">
              {guide.notes.map((note) => (
                <li key={note} className="text-[13px] opacity-80 leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
          </PremiumCard>
        </motion.div>
      </motion.section>
    </motion.div>
  );
};

export default RulesGuide;
