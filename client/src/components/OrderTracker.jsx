import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { ORDER_STEPS, STATUS, dateTime, stepIndex } from '../lib/format';

/** Horizontal step tracker. The fill bar and active step animate whenever a live update arrives. */
export function OrderSteps({ status, compact = false }) {
  if (status === 'cancelled') {
    return <p className="rounded-xl bg-danger-100 px-4 py-3 text-sm font-medium text-danger-700">This order was cancelled.</p>;
  }
  const current = stepIndex(status);
  const pct = (current / (ORDER_STEPS.length - 1)) * 100;
  return (
    <div className="relative" role="list" aria-label="Order progress">
      <div className="absolute top-[15px] right-[8%] left-[8%] h-[3px] rounded-full bg-silver-200" aria-hidden />
      <motion.div className="absolute top-[15px] left-[8%] h-[3px] rounded-full bg-gradient-to-r from-brand-700 to-brand-400" aria-hidden
        initial={false} animate={{ width: `${pct * 0.84}%` }} transition={{ type: 'spring', stiffness: 70, damping: 18 }} />
      <ol className="relative grid grid-cols-6">
        {ORDER_STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.key} className="flex flex-col items-center text-center" role="listitem" aria-current={active ? 'step' : undefined}>
              <motion.span
                initial={false}
                animate={{ scale: active ? 1.12 : 1, backgroundColor: done || active ? '#163f5b' : '#ffffff', borderColor: done || active ? '#163f5b' : '#cdd6df' }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="relative grid size-8 place-items-center rounded-full border-2 text-white"
              >
                {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : active ? <span className="size-2.5 rounded-full bg-white" /> : null}
                {active && status !== 'received' && (
                  <motion.span className="absolute inset-0 rounded-full border-2 border-brand-500" aria-hidden
                    animate={{ scale: [1, 1.7], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }} />
                )}
              </motion.span>
              {!compact && (
                <span className={`mt-2 text-[11px] leading-tight font-medium sm:text-xs ${active ? 'text-ink' : done ? 'text-ink-soft' : 'text-muted'}`}>{s.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Vertical event log with who did what and when. */
export function OrderTimeline({ events }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-silver-200 pl-5">
      {events.map((e, i) => (
        <motion.li key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="relative">
          <span className={`absolute top-1 -left-[27px] size-3 rounded-full border-2 border-white ${i === events.length - 1 ? 'bg-brand-600' : 'bg-silver-400'}`} aria-hidden />
          <p className="text-sm font-medium text-ink">{STATUS[e.status]?.label || e.status}</p>
          <p className="text-xs text-muted">
            {dateTime(e.createdAt)}{e.actorName ? ` · ${e.actorRole === 'admin' ? 'Anavrin team' : e.actorName}` : ''}
          </p>
          {e.note && <p className="mt-0.5 text-[13px] text-ink-soft">{e.note}</p>}
        </motion.li>
      ))}
    </ol>
  );
}
