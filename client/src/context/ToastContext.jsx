import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

const ICONS = { success: CircleCheck, error: TriangleAlert, info: Info };
const TONES = {
  success: 'text-ok-700',
  error: 'text-danger-700',
  info: 'text-brand-600',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message, { type = 'success', title, duration = 4200 } = {}) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, message, type, title }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
        role="region" aria-live="polite" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.type] || Info;
            return (
              <motion.div key={t.id} layout
                initial={{ opacity: 0, y: -16, scale: 0.94, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3">
                <Icon className={`mt-0.5 size-5 shrink-0 ${TONES[t.type]}`} aria-hidden />
                <div className="min-w-0 flex-1 text-sm">
                  {t.title && <p className="font-semibold text-ink">{t.title}</p>}
                  <p className="text-ink-soft">{t.message}</p>
                </div>
                <button onClick={() => dismiss(t.id)} className="-m-1 rounded-full p-1 text-muted hover:bg-white/70 hover:text-ink" aria-label="Dismiss notification">
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
