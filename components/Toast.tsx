import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'warning';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgColor = {
    error: 'bg-red-900/95 border-red-600',
    success: 'bg-green-900/95 border-green-600',
    warning: 'bg-yellow-900/95 border-yellow-600',
  }[toast.type];

  const iconColor = {
    error: 'text-red-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
  }[toast.type];

  const icon = {
    error: '!',
    success: '✓',
    warning: '⚠',
  }[toast.type];

  return (
    <div
      className={`${bgColor} border rounded-lg p-4 shadow-lg animate-in slide-in-from-right fade-in duration-300 flex items-start gap-3`}
      role="alert"
    >
      <span className={`${iconColor} font-bold text-lg flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full border ${iconColor.replace('text-', 'border-')}`}>
        {icon}
      </span>
      <p className="text-white text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-zinc-400 hover:text-white transition-colors text-lg leading-none"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
