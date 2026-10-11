/** Small, dependency-free hardening helpers. */

/** Fixed-window rate limiter kept in memory (fine for a single server process). */
export function rateLimit({ windowMs, max, key = (req) => req.ip, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message || 'Too many attempts. Please wait a few minutes and try again.' });
    }
    next();
  };
}

// Google Maps needs its own hosts (and, per Google's CSP guide, inline/eval for its loader),
// so those are only allowed when a Maps key is configured. The open map (MapLibre + OpenFreeMap)
// needs its vector tiles/fonts/sprites and a web worker; its place search goes through /api/geo.
function buildCsp(google) {
  const g = google;
  return [
    "default-src 'self'",
    g ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com *.google.com https://*.ggpht.com *.googleusercontent.com blob:"
      : "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' https: data: blob:",
    `connect-src 'self' ws: wss: https://tiles.openfreemap.org${g ? ' https://*.googleapis.com *.google.com https://*.gstatic.com data: blob:' : ''}`,
    "worker-src 'self' blob:",
    ...(g ? ['frame-src *.google.com'] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Geolocation is used for the checkout pin and for riders' live location.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
    res.set('Content-Security-Policy', buildCsp(!!process.env.GOOGLE_MAPS_API_KEY));
  }
  next();
}
