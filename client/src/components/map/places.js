import { api } from '../../lib/api';

/**
 * Place search and reverse geocoding for the checkout pin. The search provider always matches the
 * map provider (Google results only on a Google map):
 *  - Google: Places API (New) autocomplete + Geocoder, when a Maps key is configured.
 *  - Open map: OpenStreetMap Nominatim through our server (/api/geo), which enforces Nominatim's
 *    usage policy (1 request/s for the whole app, caching, no search-as-you-type):
 *    https://operations.osmfoundation.org/policies/nominatim/
 */

let sessionToken = null;

async function googlePlaces() {
  const g = window.google?.maps;
  if (!g?.importLibrary) throw new Error('Google Maps is not loaded.');
  return g.importLibrary('places');
}

/** Returns [{ id, title, subtitle, resolve: () => Promise<{lat,lng,label}> }]. */
export async function searchPlaces(query, provider, near) {
  const q = query.trim();
  if (q.length < 2) return [];
  if (provider === 'google') {
    const { AutocompleteSuggestion, AutocompleteSessionToken } = await googlePlaces();
    sessionToken ||= new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: q,
      includedRegionCodes: ['ke'],
      region: 'ke',
      language: 'en',
      sessionToken,
      ...(near ? { origin: near, locationBias: { center: near, radius: 30000 } } : {}),
    });
    return suggestions.filter((s) => s.placePrediction).slice(0, 5).map((s, i) => {
      const p = s.placePrediction;
      const title = p.mainText?.text || p.text?.text;
      return {
        id: p.placeId || String(i),
        title,
        subtitle: p.secondaryText?.text || '',
        resolve: async () => {
          const place = p.toPlace();
          // location + formattedAddress are "Essentials" fields; displayName would bill at the Pro tier.
          await place.fetchFields({ fields: ['location', 'formattedAddress'] });
          sessionToken = null; // a session ends when a place is picked
          return { lat: place.location.lat(), lng: place.location.lng(), label: title || place.formattedAddress };
        },
      };
    });
  }
  const { results } = await api(`/geo/search?q=${encodeURIComponent(q)}`);
  return results.map((r) => ({ ...r, resolve: async () => ({ lat: r.lat, lng: r.lng, label: r.title }) }));
}

/** A short human-readable name for a pinned point, or null. Call on tap / drag end only. */
export async function reverseGeocode(pos, provider) {
  try {
    if (provider === 'google') {
      const { Geocoder } = await window.google.maps.importLibrary('geocoding');
      const { results } = await new Geocoder().geocode({ location: pos, region: 'ke', language: 'en', fulfillOnZeroResults: true });
      const best = results.find((r) => !r.types.includes('plus_code')) || results[0];
      return best ? best.formatted_address.replace(/, Kenya$/, '') : null;
    }
    const { label } = await api(`/geo/reverse?lat=${pos.lat}&lng=${pos.lng}`);
    return label;
  } catch {
    return null;
  }
}

export const SEARCH_ATTRIBUTION = {
  google: 'Google Maps',
  open: 'Search by Nominatim · © OpenStreetMap contributors',
};
