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
export function LocationPicker({ value, onChange, error, store }) {
  const { provider } = useMapProvider();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [fitKey, setFitKey] = useState(0);
  const [naming, setNaming] = useState(false);
  const typing = useRef(0);
  const reverseSeq = useRef(0);

  const place = async (pos, label = null, { recenter = false } = {}) => {
    onChange({ lat: pos.lat, lng: pos.lng, label });
    if (recenter) setFitKey((k) => k + 1);
    if (label) return;
    const seq = ++reverseSeq.current;
    setNaming(true);
    const name = await reverseGeocode(pos, provider);
    if (seq !== reverseSeq.current) return; // a newer pin superseded this one
    setNaming(false);
    if (name) onChange({ lat: pos.lat, lng: pos.lng, label: name });
  };

  // Google supports search-as-you-type; the open fallback only searches when submitted.
  useEffect(() => {
    if (provider !== 'google') return undefined;
    clearTimeout(typing.current);
    if (query.trim().length < 3) { setResults(null); return undefined; }
    typing.current = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(typing.current);
  }, [query, provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async (q) => {
    setSearching(true);
    setSearchError('');
    try {
      setResults(await searchPlaces(q, provider, value || store || NAIROBI));
    } catch (err) {
      setSearchError(err.message || 'Search is unavailable. Tap the map instead.');
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const choose = async (r) => {
    setResults(null);
    setQuery(r.title);
    try {
      const pos = await r.resolve();
      place(pos, pos.label, { recenter: true });
    } catch {
      setSearchError('Couldn’t open that place. Try another or tap the map.');
    }
  };

  const locate = () => {
    if (!navigator.geolocation) { setGeoError('Location isn’t available in this browser.'); return; }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); place({ lat: p.coords.latitude, lng: p.coords.longitude }, null, { recenter: true }); },
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
        label="Delivery location map"
        center={value || NAIROBI}
        zoom={value ? 16 : 12}
        markers={markers}
        fitPoints={value ? [value] : []}
        fitKey={fitKey}
        onMapClick={(pos) => place(pos)}
      >
        <form
          className="absolute inset-x-3 top-3 z-[1100]"
          role="search"
          onSubmit={(e) => { e.preventDefault(); runSearch(query); }}
        >
          <div className="flex items-center gap-2 rounded-full bg-white px-4 shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)]">
            <Search className="size-4 shrink-0 text-[#5f6368]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search estate, building or landmark"
              aria-label="Search for your delivery location"
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
            />
            {searching ? <Spinner className="size-4 text-[#5f6368]" /> : query && (
              <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); setResults(null); }} className="-mr-1 grid size-8 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]">
                <X className="size-4" />
              </button>
            )}
            {provider !== 'google' && <button type="submit" className="-mr-2 rounded-full px-3 py-1.5 text-sm font-semibold text-[#1a73e8] hover:bg-[#e8f0fe]">Search</button>}
          </div>
          <AnimatePresence>
            {(results || searchError) && (
              <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="mt-2 max-h-60 overflow-auto rounded-2xl bg-white py-1 shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)]">
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
                {results?.length > 0 && (
                  <li className="border-t border-[#f1f3f4] px-4 pt-1.5 pb-1 text-right text-[11px] text-[#5f6368]">
                    {provider === 'google' ? SEARCH_ATTRIBUTION.google : (
                      <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer" className="hover:underline">{SEARCH_ATTRIBUTION.open}</a>
                    )}
                  </li>
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        </form>

        <div className="absolute right-3 bottom-8 z-[1100] flex flex-col gap-2">
          <MapFab onClick={locate} label="Use my current location">
            {locating ? <Spinner className="size-5 text-[#1a73e8]" /> : <LocateFixed className="size-5 text-[#1a73e8]" />}
          </MapFab>
        </div>

        {!value && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-8 z-[1050] flex justify-center px-16">
            <span className="rounded-full bg-[#202124]/85 px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg">
              Tap the map to drop your pin
            </span>
          </motion.div>
        )}
      </MapCanvas>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {value ? (
          <>
            <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
              <MapPin className="size-4 shrink-0 text-[#EA4335]" aria-hidden />
              <span className="truncate">{naming ? 'Finding address…' : value.label || formatLatLng(value)}</span>
            </span>
            <a href={pinUrl(value)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
              Check in Google Maps <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </>
        ) : <span className="text-muted">No pin yet. The rider uses it to navigate straight to you.</span>}
      </div>
      {(error || geoError) && <p className="field-error" role="alert">{error || geoError}</p>}
    </div>
  );
}
