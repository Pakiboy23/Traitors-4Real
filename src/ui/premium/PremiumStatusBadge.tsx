import React from "react";
import { cn } from "./cn";

type PremiumStatusTone = "neutral" | "positive" | "negative" | "warning" | "accent";

interface PremiumStatusBadgeProps {
  children: React.ReactNode;
  tone?: PremiumStatusTone;
  className?: string;
}

const toneClass: Record<PremiumStatusTone, string> = {
  neutral: "premium-status",
  positive: "premium-status premium-status-positive",
  negative: "premium-status premium-status-negative",
  warning: "premium-status premium-status-warning",
  accent: "premium-status premium-status-accent",
};

const PremiumStatusBadge: React.FC<PremiumStatusBadgeProps> = ({
  children,
  className,
  tone = "neutral",
}) => {
  return <span className={cn(toneClass[tone], className)}>{children}</span>;
};

export default PremiumStatusBadge;
