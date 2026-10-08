const kes = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });
export const money = (n) => kes.format(n || 0).replace('KES', 'KSh').replace(/ /g, ' ');
export const num = (n) => new Intl.NumberFormat('en-KE').format(n || 0);

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS".
export const parseDate = (s) => (s ? new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`) : null);

const dateFmt = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
export const dateTime = (s) => (s ? dateFmt.format(parseDate(s)) : '');
export const dateOnly = (s) => (s ? dayFmt.format(parseDate(s)) : '');

export function timeAgo(s) {
  const d = parseDate(s);
  if (!d) return '';
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  return dateOnly(s);
}

/** Format a stored +2547XXXXXXXX number as 0712 345 678 for display. */
export function phoneLocal(p) {
  if (!p) return '';
  const m = p.match(/^\+254(\d{3})(\d{3})(\d{3})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : p;
}
export const phoneDigits = (p) => (p || '').replace(/\D/g, '');

export function isKePhone(input) {
  const digits = String(input || '').replace(/[\s()-]/g, '');
  return /^(?:\+?254|0)?[17]\d{8}$/.test(digits);
}

export const ORDER_STEPS = [
  { key: 'placed', label: 'Order placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'assigned', label: 'Rider assigned' },
  { key: 'out_for_delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'received', label: 'Received' },
];

export const STATUS = {
  placed: { label: 'Awaiting confirmation', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'brand' },
  assigned: { label: 'Rider assigned', tone: 'brand' },
  out_for_delivery: { label: 'On the way', tone: 'berry' },
  delivered: { label: 'Delivered', tone: 'ok' },
  received: { label: 'Completed', tone: 'ok' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  payment_confirmed: { label: 'Payment confirmed', tone: 'ok' },
};

export const stepIndex = (status) => ORDER_STEPS.findIndex((s) => s.key === status);

export const VEHICLES = {
  motorbike: 'Motorbike',
  bicycle: 'Bicycle',
  car: 'Car',
  tuktuk: 'Tuk-tuk',
  on_foot: 'On foot',
};

export const homeFor = (user) => {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'rider') return user.status === 'active' ? '/rider' : '/rider/status';
  return '/home';
};

export const imageSrc = (url) => url || '/anavrin-logo.png';
