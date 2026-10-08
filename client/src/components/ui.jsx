import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LoaderCircle, X } from 'lucide-react';
import { STATUS } from '../lib/format';

const TONE = {
  brand: 'bg-brand-100 text-brand-800',
  berry: 'bg-berry-100 text-berry-700',
  ok: 'bg-ok-100 text-ok-700',
  warn: 'bg-warn-100 text-warn-700',
  danger: 'bg-danger-100 text-danger-700',
  neutral: 'bg-silver-200 text-ink-soft',
};

export function Chip({ tone = 'neutral', children, className = '' }) {
  return <span className={`chip ${TONE[tone]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'neutral' };
  return (
    <motion.span key={status} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }} className={`chip ${TONE[s.tone]}`}>
      {status === 'out_for_delivery' && <span className="live-dot size-1.5 rounded-full bg-current" aria-hidden />}
      {s.label}
    </motion.span>
  );
}

export function PaymentBadge({ status, method }) {
  return status === 'paid'
    ? <Chip tone="ok">Paid · {method === 'mpesa' ? 'M-Pesa' : 'Cash'}</Chip>
    : <Chip tone="warn">Unpaid · {method === 'mpesa' ? 'M-Pesa' : 'Cash'} on delivery</Chip>;
}

export function Spinner({ className = 'size-4' }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden />;
}

function useLockScroll(open) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const fn = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, wide = false, labelledBy }) {
  useLockScroll(open);
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-brand-950/40 backdrop-blur-[6px]" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : title}
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-[var(--shadow-lift)] sm:rounded-3xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {title && (
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-silver-200 bg-white/90 px-5 py-4 backdrop-blur">
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                <CloseButton onClick={onClose} />
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, side = 'right' }) {
  useLockScroll(open);
  useEscape(open, onClose);
  const from = side === 'right' ? '100%' : '-100%';
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-brand-950/35 backdrop-blur-[4px]" onClick={onClose} aria-hidden />
          <motion.aside
            role="dialog" aria-modal="true" aria-label={title}
            className={`absolute top-0 bottom-0 flex w-full max-w-md flex-col bg-silver-50 shadow-[var(--shadow-lift)] ${side === 'right' ? 'right-0' : 'left-0'}`}
            initial={{ x: from }} animate={{ x: 0 }} exit={{ x: from, transition: { duration: 0.22, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-silver-200 bg-white px-5 py-4">
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <CloseButton onClick={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="border-t border-silver-200 bg-white px-5 py-4 pb-safe">{footer}</div>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function CloseButton({ onClick, label = 'Close' }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-silver-100 hover:text-ink active:scale-95">
      <X className="size-5" />
    </button>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="glass mb-4 grid size-14 place-items-center rounded-2xl text-brand-600">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LiveIndicator({ label = 'Live' }) {
  return (
    <span className="chip bg-ok-100 text-ok-700">
      <span className="live-dot size-1.5 rounded-full bg-ok-700" aria-hidden />
      {label}
    </span>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      {label && <label className="field-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Stars({ rating, count }) {
  const full = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" aria-label={`Rated ${rating} out of 5 from ${count} reviews`}>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} viewBox="0 0 20 20" className="size-3.5">
            <defs>
              <linearGradient id={`half-${i}`}><stop offset="50%" stopColor="#b7791f" /><stop offset="50%" stopColor="#cdd6df" /></linearGradient>
            </defs>
            <path fill={full >= i ? '#b7791f' : full >= i - 0.5 ? `url(#half-${i})` : '#cdd6df'}
              d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
          </svg>
        ))}
      </span>
      <span className="tabular">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="tabular">({count.toLocaleString()})</span>}
    </span>
  );
}
