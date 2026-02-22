import React from "react";
import { cn } from "./cn";

type PremiumButtonVariant = "primary" | "secondary" | "ghost";

interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PremiumButtonVariant;
}

const variantClass: Record<PremiumButtonVariant, string> = {
  primary: "premium-btn premium-btn-primary",
  secondary: "premium-btn premium-btn-secondary",
  ghost: "premium-btn premium-btn-ghost",
};

const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  className,
  type = "button",
  variant = "secondary",
  ...rest
}) => {
  return (
    <button type={type} className={cn(variantClass[variant], className)} {...rest}>
      {children}
    </button>
  );
};

export default PremiumButton;
