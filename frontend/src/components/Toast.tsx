import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

type ToastType = "success" | "error" | "info" | "win";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  info: "💡",
  win: "🏆",
};

const TOAST_STYLES: Record<ToastType, string> = {
  success:
    "bg-emerald-950/90 border-emerald-500/30 text-emerald-100 shadow-glow-green",
  error:
    "bg-red-950/90 border-red-500/30 text-red-100",
  info:
    "bg-brand-950/90 border-brand-500/30 text-brand-100 shadow-glow-blue",
  win:
    "bg-gradient-to-r from-amber-950/90 via-yellow-950/90 to-amber-950/90 border-yellow-500/40 text-yellow-100 shadow-glow-gold",
};

const TOAST_DURATION = 4000;
let idCounter = 0;

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100);
      setProgress(pct);
      if (pct <= 0) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const barColor = {
    success: "bg-emerald-400",
    error: "bg-red-400",
    info: "bg-brand-400",
    win: "bg-yellow-400",
  }[toast.type];

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border backdrop-blur-xl px-4 py-3.5
        flex items-start gap-3 min-w-[280px] max-w-[420px] cursor-pointer
        transition-all duration-300
        ${toast.exiting ? "opacity-0 translate-x-full scale-95" : "animate-slideInRight"}
        ${TOAST_STYLES[toast.type]}
      `}
      onClick={() => onRemove(toast.id)}
      role="alert"
    >
      {/* Icon */}
      <span className="text-lg flex-shrink-0 mt-0.5">{TOAST_ICONS[toast.type]}</span>

      {/* Message */}
      <p className="text-sm font-medium leading-snug flex-1">{toast.message}</p>

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
        className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.05]">
        <div
          className={`h-full ${barColor} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), TOAST_DURATION);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
