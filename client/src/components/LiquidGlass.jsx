import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';

/**
 * SVG displacement filter used to bend the backdrop under glass surfaces (Chromium only).
 * Approach adapted from the 21st.dev "Apple Tahoe Liquid Glass" component; Safari and Firefox fall back to blur.
 */
export function LiquidGlassFilter() {
  useEffect(() => {
    const brands = navigator.userAgentData?.brands?.map((b) => b.brand) || [];
    const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b));
    const reduce = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
    if (chromium && !reduce) document.documentElement.classList.add('lg-refract');
  }, []);
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <filter id="lg-refraction" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="11" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2.5" result="smooth" />
        <feDisplacementMap in="SourceGraphic" in2="smooth" scale="34" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

const isActive = (item, pathname) => {
  if (item.match) return item.match(pathname);
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
};

/**
 * Navigation with an Apple-style liquid "water bubble" that glides to the active (or hovered) item,
 * squashing and stretching like a droplet as it moves.
 */
export function LiquidNav({ items, dark = false, vertical = false, className = '', itemClassName = '', showLabels = true, onNavigate }) {
  const { pathname } = useLocation();
  const groupId = useId();
  const activeIndex = items.findIndex((it) => isActive(it, pathname));
  const [hover, setHover] = useState(null);
  const target = hover ?? activeIndex;

  return (
    <nav className={className} onMouseLeave={() => setHover(null)}>
      <ul className={`relative flex ${vertical ? 'flex-col gap-1' : 'items-center gap-0.5'}`}>
        {items.map((item, i) => {
          const active = i === activeIndex;
          const Icon = item.icon;
          return (
            <li key={item.to} className="relative" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              {target === i && (
                <motion.span
                  layoutId={`bubble-${groupId}`}
                  className="glass-bubble absolute inset-0 rounded-full"
                  style={{ borderRadius: 999 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.9 }}
                  aria-hidden
                >
                  {/* Droplet squash on every move */}
                  <motion.span
                    key={target}
                    className="absolute inset-0 rounded-[inherit]"
                    initial={{ scaleX: 1.14, scaleY: 0.86 }}
                    animate={{ scaleX: 1, scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 9 }}
                  />
                </motion.span>
              )}
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                aria-label={showLabels ? undefined : item.label}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative z-10 flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors duration-200',
                  vertical ? 'w-full py-2.5' : 'py-2',
                  dark
                    ? active ? 'text-white' : 'text-white/70 hover:text-white'
                    : active ? 'text-brand-900' : 'text-ink-soft hover:text-ink',
                  itemClassName,
                ].join(' ')}
              >
                {Icon && <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.3 : 1.9} aria-hidden />}
                {showLabels && <span className="whitespace-nowrap">{item.label}</span>}
                {item.badge > 0 && (
                  <motion.span
                    key={item.badge}
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                    className={`ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular ${dark ? 'bg-white text-brand-900' : 'bg-berry-600 text-white'} ${showLabels ? '' : 'absolute -top-1 -right-1'}`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </motion.span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Compact segmented control using the same bubble (filters, tabs). */
export function LiquidSegmented({ options, value, onChange, className = '', size = 'md' }) {
  const groupId = useId();
  return (
    <div role="tablist" className={`glass inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 scrollbar-none ${className}`}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={`relative shrink-0 rounded-full ${size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm'} font-medium transition-colors ${selected ? 'text-brand-900' : 'text-ink-soft hover:text-ink'}`}
          >
            {selected && (
              <motion.span layoutId={`seg-${groupId}`} className="glass-bubble absolute inset-0 rounded-full" style={{ borderRadius: 999 }}
                transition={{ type: 'spring', stiffness: 500, damping: 34 }} aria-hidden />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              {opt.label}
              {opt.count !== undefined && <span className="tabular text-xs text-muted">{opt.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
