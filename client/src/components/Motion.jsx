import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { animate, motion, useInView, useIsPresent, useScroll, useSpring } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];

/** Fades and lifts content into place as it scrolls into view. */
export function Reveal({ children, delay = 0, y = 28, className = '', as = 'div', once = true, amount = 0.2 }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, amount }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/** Animated page wrapper used for route transitions. */
export function Page({ children, className = '' }) {
  return (
    <motion.main
      className={className}
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12, filter: 'blur(6px)', transition: { duration: 0.22, ease: 'easeIn' } }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.main>
  );
}

/** Thin progress bar that tracks how far down the page you've scrolled. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-brand-700 via-brand-400 to-berry-600"
      style={{ scaleX }}
    />
  );
}

/** Number that counts up when it scrolls into view and glides to new values on live updates. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-KE'), className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const current = useRef(0);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(current.current, value, {
      duration: current.current === 0 ? 1.1 : 0.6,
      ease: EASE,
      onUpdate: (v) => {
        current.current = v;
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, inView, format]);
  return <span ref={ref} className={`tabular ${className}`}>{format(0)}</span>;
}

export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
export const staggerChild = {
  hidden: { opacity: 0, y: 22, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE } },
};

/**
 * <Navigate> that only fires on the page currently on screen. Pages leaving via an exit
 * animation stay mounted briefly and must not redirect (e.g. after login or logout).
 */
export function Redirect(props) {
  const present = useIsPresent();
  return present ? <Navigate {...props} /> : null;
}
