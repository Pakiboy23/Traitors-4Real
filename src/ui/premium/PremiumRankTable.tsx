import React from "react";
import { cn } from "./cn";

interface PremiumRankTableHeader {
  id: string;
  label: string;
  align?: "left" | "right";
}

interface PremiumRankTableProps {
  headers: PremiumRankTableHeader[];
  children: React.ReactNode;
  className?: string;
}

export const PremiumRankTable: React.FC<PremiumRankTableProps> = ({
  headers,
  children,
  className,
}) => {
  return (
    <div className={cn("premium-rank-table", className)}>
      <div className="premium-rank-head">
        {headers.map((header) => (
          <div
            key={header.id}
            className={cn(
              "premium-rank-head-cell",
              header.align === "right" && "premium-rank-head-cell-right"
            )}
          >
            {header.label}
          </div>
        ))}
      </div>
      <div className="premium-rank-body">{children}</div>
    </div>
  );
};

interface PremiumRankRowProps {
  children: React.ReactNode;
  expanded?: boolean;
  className?: string;
}

export const PremiumRankRow: React.FC<PremiumRankRowProps> = ({
  children,
  expanded,
  className,
}) => {
  return (
    <article
      className={cn(
        "premium-rank-row",
        expanded && "premium-rank-row-expanded",
        className
      )}
    >
      {children}
    </article>
  );
};
