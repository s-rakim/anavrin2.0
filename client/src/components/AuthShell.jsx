import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Page } from './Motion';

/** Shared frame for login, sign-up and the rider application. */
export function AuthShell({ title, subtitle, children, aside, wide = false }) {
  return (
    <Page className="flex min-h-dvh items-start justify-center px-4 pt-28 pb-28 sm:items-center sm:pt-32">
      <div className={`grid w-full gap-6 ${wide ? 'max-w-5xl lg:grid-cols-[1fr_1.2fr]' : 'max-w-4xl md:grid-cols-[1fr_1fr]'}`}>
        <motion.div
          initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-dark relative hidden overflow-hidden rounded-[32px] p-10 text-white md:flex md:flex-col"
        >
          <motion.div className="absolute -top-20 -right-16 size-72 rounded-full bg-brand-400/30 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} aria-hidden />
          <Link to="/" className="relative"><img src="/anavrin-logo-light.png" alt="Anavrin" className="h-16 w-auto" /></Link>
          <div className="relative mt-auto pt-16">{aside}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="card rounded-[32px] p-6 sm:p-10"
        >
          <Link to="/" className="mb-6 inline-block md:hidden"><img src="/anavrin-logo.png" alt="Anavrin" className="h-12 w-auto" /></Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </Page>
  );
}
