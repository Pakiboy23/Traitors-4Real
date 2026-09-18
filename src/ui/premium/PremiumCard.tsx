import React from "react";
import { cn } from "./cn";

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
}

const PremiumCard: React.FC<PremiumCardProps> = ({ children, className }) => {
  return <section className={cn("premium-card", className)}>{children}</section>;
};

export default PremiumCard;
