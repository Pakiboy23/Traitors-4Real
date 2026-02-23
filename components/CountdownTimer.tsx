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
      <p className="text-sm text-center text-slate-600 dark:text-slate-300">
        Countdown unavailable.
      </p>
    );
  }

  if (parts.expired) {
    return (
      <p className="text-center font-semibold text-slate-700 dark:text-slate-200">
        Picks are locked.
      </p>
    );
  }

  const cells: Array<{ label: string; value: number }> = [
    { label: "Days", value: parts.days },
    { label: "Hours", value: parts.hours },
    { label: "Minutes", value: parts.minutes },
    { label: "Seconds", value: parts.seconds },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-md bg-white/60 dark:bg-slate-800/70 px-2 py-3">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatValue(cell.value)}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {cell.label}
          </p>
        </div>
      ))}
    </div>
  );
};

export default CountdownTimer;
