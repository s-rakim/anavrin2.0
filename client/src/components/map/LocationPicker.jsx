import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { NAIROBI, formatLatLng, pinUrl } from '../../lib/geo';
import { Spinner } from '../ui';
import { MapCanvas, MapFab } from './MapCanvas';
import { useMapProvider } from './provider';
import { SEARCH_ATTRIBUTION, reverseGeocode, searchPlaces } from './places';

/**
 * Drop-off pin for checkout. Shoppers can search a place, tap the map, drag the red pin,
 * or use their phone's location. `value` is { lat, lng, label } or null.
 */
export function LocationPicker({ value, onChange, error, store, onAvailability }) {
  const { provider } = useMapProvider();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [fitKey, setFitKey] = useState(0);
  const [naming, setNaming] = useState(false);
  const [mapAvailable, setMapAvailable] = useState(true);
  const typing = useRef(0);
  const pinSeq = useRef(0); // bumps on every pin change so late lookups can't move the pin back
  const searchSeq = useRef(0);
  const chosenTitle = useRef(null);

  const lookupSource = provider === 'google' ? 'google' : 'osm';
  // pointSource: 'user' (tap/drag), 'device' (GPS) or the search provider; labelSource likewise.
  const place = async (pos, label = null, { recenter = false, pointSource = 'user' } = {}) => {
    const seq = ++pinSeq.current;
    const base = { lat: pos.lat, lng: pos.lng, pointSource };
    onChange({ ...base, label, labelSource: label ? pointSource : null });
    setResults(null);
    if (recenter) setFitKey((k) => k + 1);
    if (label) { setNaming(false); return; }
    setNaming(true);
    const name = await reverseGeocode(pos, provider);
    if (seq !== pinSeq.current) return; // a newer pin superseded this one
    setNaming(false);
    if (name) onChange({ ...base, label: name, labelSource: lookupSource });
  };

  // Google supports search-as-you-type; the open fallback only searches when submitted.
  useEffect(() => {
    if (provider !== 'google') return undefined;
    clearTimeout(typing.current);
    if (query === chosenTitle.current) return undefined; // the text came from picking a result
    if (query.trim().length < 3) { setResults(null); return undefined; }
    typing.current = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(typing.current);
  }, [query, provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async (q) => {
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError('');
    try {
      const found = await searchPlaces(q, provider === 'google' ? 'google' : 'open', value || store || NAIROBI);
      if (seq === searchSeq.current) setResults(found); // ignore answers to older queries
    } catch (err) {
      if (seq !== searchSeq.current) return;
      setSearchError(err.message || 'Search is unavailable. Tap the map instead.');
      setResults(null);
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  const choose = async (r) => {
    setResults(null);
    chosenTitle.current = r.title;
    setQuery(r.title);
    searchSeq.current += 1;
    const seq = pinSeq.current;
    try {
      const pos = await r.resolve();
      if (seq !== pinSeq.current) return; // the shopper moved the pin meanwhile
      place(pos, pos.label, { recenter: true, pointSource: lookupSource });
    } catch {
      setSearchError('Couldn’t open that place. Try another or tap the map.');
    }
  };

  const locate = () => {
    if (!navigator.geolocation) { setGeoError('Location isn’t available in this browser.'); return; }
    setLocating(true);
    setGeoError('');
    const seq = pinSeq.current;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (seq !== pinSeq.current) return; // the shopper placed a pin while we waited for GPS
        place({ lat: p.coords.latitude, lng: p.coords.longitude }, null, { recenter: true, pointSource: 'device' });
      },
      (err) => {
        setLocating(false);
        setGeoError(err.code === err.PERMISSION_DENIED
          ? 'Location permission was blocked. Allow it in your browser settings, or search / tap the map.'
          : 'We couldn’t find your location. Search or tap the map instead.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const markers = [
    store && { id: 'store', kind: 'store', position: store, title: store.name },
    value && {
      id: 'dest', kind: 'destination', position: value, draggable: true, zIndex: 10, title: 'Your drop-off point. Drag to adjust.',
      onDragEnd: (pos) => place(pos),
    },
  ].filter(Boolean);

  return (
    <div>
      <MapCanvas
        className={`h-80 sm:h-96 ${error ? 'ring-2 ring-danger-700' : ''}`}
        label="Delivery location map. Use the arrow keys to move the map and press Enter to drop the pin at its centre."
        center={value || NAIROBI}
        zoom={value ? 16 : 12}
        markers={markers}
        fitPoints={value ? [value] : []}
        fitKey={fitKey}
        onMapClick={(pos) => place(pos)}
        onAvailability={(ok) => { setMapAvailable(ok); onAvailability?.(ok); }}
      >
        {/* Not a <form>: this sits inside the checkout form, and Enter here must never submit the order. */}
        <div className="absolute inset-x-3 top-3 z-[1100]" role="search">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)]">
            <Search className="size-4 shrink-0 text-[#5f6368]" aria-hidden />
            <input
              value={query}
              onChange={(e) => { chosenTitle.current = null; setQuery(e.target.value); }}
              placeholder="Search estate, building or landmark"
              aria-label="Search for your delivery location"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); runSearch(query); } }}
              enterKeyHint="search"
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
            />
            {searching ? <Spinner className="size-4 text-[#5f6368]" /> : query && (
              <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); setResults(null); }} className="-mr-1 grid size-8 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]">
                <X className="size-4" />
              </button>
            )}
            {provider !== 'google' && <button type="button" onClick={() => runSearch(query)} className="-mr-2 rounded-full px-3 py-1.5 text-sm font-semibold text-[#1a73e8] hover:bg-[#e8f0fe]">Search</button>}
          </div>
          <AnimatePresence>
            {(results || searchError) && (
              // The list scrolls inside a box that always ends above the map's bottom-left logo, and the
              // search credit is a fixed footer, so both stay visible (Google Places attribution rules).
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="mt-2 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)]">
                <ul className="max-h-48 overflow-auto py-1 sm:max-h-60">
                  {searchError && <li className="px-4 py-3 text-sm text-danger-700">{searchError}</li>}
                  {results?.length === 0 && <li className="px-4 py-3 text-sm text-[#5f6368]">No places found. Try a nearby landmark.</li>}
                  {results?.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => choose(r)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[#f1f3f4]">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-[#5f6368]" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[#202124]">{r.title}</span>
                          {r.subtitle && <span className="block truncate text-xs text-[#5f6368]">{r.subtitle}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {results?.length > 0 && (
                  <p className="border-t border-[#f1f3f4] px-4 py-1.5 text-right text-xs text-[#5e5e5e]">
                    {provider === 'google' ? SEARCH_ATTRIBUTION.google : (
                      <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer" className="hover:underline">{SEARCH_ATTRIBUTION.open}</a>
                    )}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!(results || searchError) && (
          <div className="absolute right-3 bottom-8 z-[1100] flex flex-col gap-2">
            <MapFab onClick={locate} label="Use my current location">
              {locating ? <Spinner className="size-5 text-[#1a73e8]" /> : <LocateFixed className="size-5 text-[#1a73e8]" />}
            </MapFab>
          </div>
        )}

        {!value && mapAvailable && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-8 z-[1050] flex justify-center px-16">
            <span className="rounded-full bg-[#202124]/85 px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg">
              Tap the map to drop your pin
            </span>
          </motion.div>
        )}
      </MapCanvas>

      <div className="mt-3 flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {value ? (
          <>
            <span className="flex min-w-0 max-w-full items-center gap-2 font-medium text-ink">
              <MapPin className="size-4 shrink-0 text-[#EA4335]" aria-hidden />
              <span className="truncate">{naming ? 'Finding address…' : value.label || formatLatLng(value)}</span>
            </span>
            <a href={pinUrl(value)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
              Check in Google Maps <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </>
        ) : <span className="text-muted">{mapAvailable
          ? 'Drop your pin (required). The rider uses it to navigate straight to you.'
          : 'Search for a nearby place or use your current location so the rider can find you. Optional on this device.'}</span>}
      </div>
      {(error || geoError) && <p className="field-error" role="alert">{error || geoError}</p>}
      {/* Screen readers: search outcomes and the chosen drop-off point. */}
      <p className="sr-only" aria-live="polite">
        {searchError || (results ? `${results.length} place${results.length === 1 ? '' : 's'} found` : value && !naming ? `Pin set: ${value.label || formatLatLng(value)}` : '')}
      </p>
    </div>
  );
}
