"use client";
/**
 * src/components/ui/Toast.tsx
 *
 * Provides:
 *   <Toast>          – context wrapper (replaces old <ToastProvider>)
 *   useToast()       – hook returning { push }
 *   toast            – imperative singleton (toast.success / toast.error / toast.info)
 *
 * Both the context hook and the imperative singleton share the same emitter
 * so they always trigger the visible Toast wrapper.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { clsx } from "clsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

type PushFn = (msg: string, type?: ToastItem["type"]) => void;

// ─── Internal event bus (imperative API) ─────────────────────────────────────

let _push: PushFn = () => {};

/**
 * Imperative toast singleton.
 *
 * Usage:
 *   import { toast } from "@/components/ui/Toast";
 *   toast.success("Saved!");
 *   toast.error("Something went wrong");
 *   toast.info("FYI…");
 */
export const toast = {
  success: (msg: string) => _push(msg, "success"),
  error:   (msg: string) => _push(msg, "error"),
  info:    (msg: string) => _push(msg, "info"),
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastCtx = createContext<{ push: PushFn }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * <Toast> wraps your layout and renders the toast stack.
 * It also powers the imperative `toast.*` singleton.
 *
 * Old alias: <ToastProvider> is exported as the same component.
 */
export function Toast({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback<PushFn>((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Wire up the imperative singleton whenever this provider mounts
  useEffect(() => {
    _push = push;
    return () => { _push = () => {}; };
  }, [push]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white",
              t.type === "success" && "bg-green-600",
              t.type === "error"   && "bg-red-600",
              t.type === "info"    && "bg-brand-600",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** @alias for backwards compatibility */
export const ToastProvider = Toast;
