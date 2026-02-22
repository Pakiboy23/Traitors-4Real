import React from "react";
import { cn } from "./cn";

interface PremiumPanelHeaderProps {
  kicker: string;
  title: string;
  description?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

const PremiumPanelHeader: React.FC<PremiumPanelHeaderProps> = ({
  kicker,
  title,
  description,
  rightSlot,
  className,
}) => {
  return (
    <header className={cn("premium-panel-header", className)}>
      <div>
        <p className="premium-kicker">{kicker}</p>
        <h2 className="premium-title">{title}</h2>
        {description && <p className="premium-subtitle">{description}</p>}
      </div>
      {rightSlot && <div className="premium-panel-header-actions">{rightSlot}</div>}
    </header>
  );
};

export default PremiumPanelHeader;
