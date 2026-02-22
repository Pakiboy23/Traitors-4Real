import React from "react";
import { cn } from "./cn";

interface PremiumFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const PremiumField: React.FC<PremiumFieldProps> = ({
  label,
  className,
  ...props
}) => {
  if (!label) {
    return <input className={cn("premium-field", className)} {...props} />;
  }

  return (
    <label className="premium-field-wrap">
      <span className="premium-field-label">{label}</span>
      <input className={cn("premium-field", className)} {...props} />
    </label>
  );
};

interface PremiumSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
}

export const PremiumSelect: React.FC<PremiumSelectProps> = ({
  label,
  className,
  children,
  ...props
}) => {
  if (!label) {
    return (
      <select className={cn("premium-select", className)} {...props}>
        {children}
      </select>
    );
  }

  return (
    <label className="premium-field-wrap">
      <span className="premium-field-label">{label}</span>
      <select className={cn("premium-select", className)} {...props}>
        {children}
      </select>
    </label>
  );
};

interface PremiumToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const PremiumToggle: React.FC<PremiumToggleProps> = ({
  label,
  checked,
  onChange,
  disabled,
  className,
}) => {
  return (
    <label className={cn("premium-toggle", className)}>
      <span className="premium-field-label">{label}</span>
      <button
        type="button"
        className={cn("premium-toggle-track", checked && "premium-toggle-track-on")}
        onClick={() => !disabled && onChange(!checked)}
        aria-pressed={checked}
        disabled={disabled}
      >
        <span className="premium-toggle-knob" />
      </button>
    </label>
  );
};
