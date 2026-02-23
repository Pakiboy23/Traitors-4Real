import React, { useEffect, useMemo, useState } from "react";

interface CountdownTimerProps {
  targetDate: string;
}

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

const EMPTY_COUNTDOWN: CountdownParts = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  expired: true,
};

const toCountdownParts = (targetMs: number): CountdownParts => {
  const now = Date.now();
  const diffMs = targetMs - now;

  if (diffMs <= 0) {
    return EMPTY_COUNTDOWN;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    expired: false,
  };
};

const formatValue = (value: number) => String(value).padStart(2, "0");

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const targetMs = useMemo(() => Date.parse(targetDate), [targetDate]);
  const [parts, setParts] = useState<CountdownParts>(() =>
    Number.isNaN(targetMs) ? EMPTY_COUNTDOWN : toCountdownParts(targetMs)
  );

  useEffect(() => {
    if (Number.isNaN(targetMs)) {
      setParts(EMPTY_COUNTDOWN);
      return;
    }

    setParts(toCountdownParts(targetMs));

    const intervalId = window.setInterval(() => {
      setParts(toCountdownParts(targetMs));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [targetMs]);

  if (Number.isNaN(targetMs)) {
    return (
      <span className="text-xs text-current/80">
        Countdown unavailable.
      </span>
    );
  }

  if (parts.expired) {
    return (
      <span className="text-xs font-semibold text-current">
        Picks are locked.
      </span>
    );
  }

  const cells: Array<{ label: string; value: number }> = [
    { label: "days", value: parts.days },
    { label: "hrs", value: parts.hours },
    { label: "min", value: parts.minutes },
    { label: "sec", value: parts.seconds },
  ];

  return (
    <div className="flex items-center space-x-2 font-mono text-[13px] leading-none text-current sm:text-sm">
      {cells.map((cell, index) => (
        <React.Fragment key={cell.label}>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span className="font-semibold tabular-nums">{formatValue(cell.value)}</span>
            <span className="text-[10px] lowercase tracking-[0.08em] opacity-85 sm:text-[11px]">
              {cell.label}
            </span>
          </span>
          {index < cells.length - 1 && <span className="opacity-50">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

export default CountdownTimer;
