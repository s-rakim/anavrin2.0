/**
 * Marker artwork shared by both map providers (Google Advanced Markers and Leaflet divIcons),
 * drawn in the style of the current Google Maps app: red drop pin for the destination,
 * blue "location puck" with a heading beam for the rider.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const MARKER_GEOMETRY = {
  destination: { size: [40, 50], anchor: [20, 48] },
  store: { size: [40, 40], anchor: [20, 20] },
  rider: { size: [64, 64], anchor: [32, 32] },
  me: { size: [64, 64], anchor: [32, 32] },
  order: { size: [30, 38], anchor: [15, 36] },
};

const STATUS_COLORS = {
  placed: '#b7791f',
  confirmed: '#295f81',
  assigned: '#295f81',
  out_for_delivery: '#5b2d8e',
};

export function markerHtml(kind, { label, heading, status, title, stale } = {}) {
  const t = esc(title || label || '');
  switch (kind) {
    case 'destination':
      return `<div class="anv-mk anv-mk-dest" title="${t}">
        <svg viewBox="0 0 40 50" width="40" height="50" aria-hidden="true">
          <path d="M20 49c-1.2-6.8-6.6-11.6-11-16.9C5.7 28.2 3 24.2 3 19 3 9.6 10.6 2 20 2s17 7.6 17 17c0 5.2-2.7 9.2-6 13.1-4.4 5.3-9.8 10.1-11 16.9z" fill="#EA4335" stroke="#B31412" stroke-width="1.5"/>
          <circle cx="20" cy="19" r="6.5" fill="#7A0E0C"/>
        </svg>
        ${label ? `<span class="anv-mk-label">${esc(label)}</span>` : ''}
      </div>`;
    case 'store':
      return `<div class="anv-mk anv-mk-store" title="${t}">
        <span class="anv-mk-store-dot"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg></span>
        ${label ? `<span class="anv-mk-label">${esc(label)}</span>` : ''}
      </div>`;
    case 'rider':
    case 'me': {
      const beam = Number.isFinite(heading)
        ? `<span class="anv-mk-beam" style="transform: rotate(${Math.round(heading)}deg)"></span>` : '';
      return `<div class="anv-mk anv-mk-puck ${kind === 'rider' ? 'is-rider' : ''} ${stale ? 'is-stale' : ''}" title="${t}">
        <span class="anv-mk-halo"></span>${beam}
        <span class="anv-mk-dot">${kind === 'rider'
          ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>' : ''}</span>
        ${label ? `<span class="anv-mk-label anv-mk-label-puck">${esc(label)}</span>` : ''}
      </div>`;
    }
    case 'order':
      return `<div class="anv-mk anv-mk-order" title="${t}">
        <svg viewBox="0 0 30 38" width="30" height="38" aria-hidden="true">
          <path d="M15 37c-.9-5.1-5-8.7-8.3-12.7C4.3 21.4 2.3 18.4 2.3 14.5 2.3 7.4 8 1.7 15 1.7s12.7 5.7 12.7 12.8c0 3.9-2 6.9-4.4 9.8C20 28.3 15.9 31.9 15 37z" fill="${STATUS_COLORS[status] || '#295f81'}" stroke="#fff" stroke-width="2"/>
          <circle cx="15" cy="14.5" r="4.5" fill="#fff"/>
        </svg>
        ${label ? `<span class="anv-mk-label">${esc(label)}</span>` : ''}
      </div>`;
    default:
      return '';
  }
}
