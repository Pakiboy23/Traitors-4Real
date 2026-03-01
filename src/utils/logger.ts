const isDebugLogsEnabled = () => {
  const value = String(import.meta.env.VITE_DEBUG_LOGS ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

export const logger = {
  log: (...args: unknown[]) => {
    if (isDebugLogsEnabled()) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDebugLogsEnabled()) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (isDebugLogsEnabled()) console.error(...args);
  },
};

