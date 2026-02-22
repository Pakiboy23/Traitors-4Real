import React from "react";

export interface PremiumKpiItem {
  label: string;
  value: string;
  hint?: string;
}

interface PremiumKpiRowProps {
  items: PremiumKpiItem[];
  className?: string;
}

const PremiumKpiRow: React.FC<PremiumKpiRowProps> = ({ items, className }) => {
  return (
    <div className={`premium-kpi-row ${className ?? ""}`.trim()}>
      {items.map((item) => (
        <article key={`${item.label}-${item.value}`} className="premium-kpi-item">
          <p className="premium-kpi-label">{item.label}</p>
          <p className="premium-kpi-value">{item.value}</p>
          {item.hint && <p className="premium-kpi-hint">{item.hint}</p>}
        </article>
      ))}
    </div>
  );
};

export default PremiumKpiRow;
