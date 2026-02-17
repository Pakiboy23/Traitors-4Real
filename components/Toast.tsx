import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 pointer-events-none" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3800);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const tone = {
    success: "border-[color:var(--success)]/50 bg-[color:var(--success)]/15 text-[color:var(--text)]",
    error: "border-[color:var(--danger)]/50 bg-[color:var(--danger)]/14 text-[color:var(--text)]",
    warning: "border-[color:var(--warning)]/50 bg-[color:var(--warning)]/16 text-[color:var(--text)]",
    info: "border-[color:var(--panel-border-strong)] bg-black/45 text-[color:var(--text)]",
  };

  const glyph = {
    success: "OK",
    error: "ER",
    warning: "WR",
    info: "IN",
  };

  return (
    <div className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${tone[toast.type]}`} role="alert">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/35 text-[10px] font-bold uppercase flex-shrink-0">
          {glyph[toast.type]}
        </span>
        <p className="text-sm leading-relaxed flex-1">{toast.message}</p>
        <button onClick={() => onRemove(toast.id)} className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] hover:text-[color:var(--text)]">
          Close
        </button>
      </div>
    </div>
  );
};

export default ToastProvider;
