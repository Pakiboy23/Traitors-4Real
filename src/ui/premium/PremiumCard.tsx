import React from "react";
import { cn } from "./cn";

type PremiumCardVariant = "default" | "elevated" | "outlined";

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: PremiumCardVariant;
}

const variantClass: Record<PremiumCardVariant, string> = {
  default: "premium-card",
  elevated: "premium-card premium-card-elevated",
  outlined: "premium-card premium-card-outlined",
};

const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className,
  variant = "default",
}) => {
  return <section className={cn(variantClass[variant], className)}>{children}</section>;
};

export default PremiumCard;
