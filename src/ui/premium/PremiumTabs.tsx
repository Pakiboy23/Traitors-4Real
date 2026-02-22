import React from "react";
import { cn } from "./cn";

interface PremiumTabItem {
  id: string;
  label: string;
}

interface PremiumTabsProps {
  items: PremiumTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

const PremiumTabs: React.FC<PremiumTabsProps> = ({
  items,
  activeId,
  onChange,
  className,
}) => {
  return (
    <nav className={cn("premium-tabs", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "premium-tab-item",
            activeId === item.id && "premium-tab-item-active"
          )}
          aria-current={activeId === item.id ? "page" : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};

export default PremiumTabs;
