import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  leaving?: boolean;
}

interface ToastApi {
  show(message: string, kind?: ToastKind): void;
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const EXIT_MS = 220;
const LIFE_MS = 2800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimer(id);
    setItems(current => current.map(item => item.id === id ? { ...item, leaving: true } : item));
    const timer = setTimeout(() => {
      setItems(current => current.filter(item => item.id !== id));
      timers.current.delete(id);
    }, EXIT_MS);
    timers.current.set(id, timer);
  }, [clearTimer]);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = crypto.randomUUID();
    setItems(current => [...current, { id, kind, message }]);
    const timer = setTimeout(() => dismiss(id), LIFE_MS);
    timers.current.set(id, timer);
  }, [dismiss]);

  const value = useMemo<ToastApi>(() => ({
    show,
    success: message => show(message, 'success'),
    error: message => show(message, 'error'),
    info: message => show(message, 'info'),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {items.map(item => {
          const Icon = item.kind === 'success' ? CheckCircle2 : item.kind === 'error' ? XCircle : Info;
          return (
            <div
              key={item.id}
              className={`toast toast-${item.kind}${item.leaving ? ' toast-leave' : ' toast-enter'}`}
              role="status"
            >
              <Icon size={17} />
              <span>{item.message}</span>
              <button className="toast-close" onClick={() => dismiss(item.id)} aria-label="关闭提示" disabled={item.leaving}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast 必须在 ToastProvider 内使用');
  return context;
}
