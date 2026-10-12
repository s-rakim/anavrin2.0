import { useEffect, useRef } from 'react';
import { LngLatBounds, Map as MlMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { MARKER_GEOMETRY, markerHtml } from './markers';
import { markOpenMapFailed } from './provider';

setWorkerUrl(workerUrl);

// OpenFreeMap: free vector tiles from OpenStreetMap data, no API key, commercial use allowed.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const PATHS_SOURCE = 'anv-paths';
const STYLE_TIMEOUT_MS = 30000;

/** Nudge the open style towards the current Google Maps palette (paler land, blue water, soft parks). */
function googleTint(map) {
  const set = (id, prop, value) => { if (map.getLayer(id)) { try { map.setPaintProperty(id, prop, value); } catch { /* layer differs */ } } };
  map.getStyle().layers.forEach((l) => {
    if (l.type === 'background') set(l.id, 'background-color', '#f5f6f7');
    if (/^water/.test(l.id) && l.type === 'fill') set(l.id, 'fill-color', '#90daee');
    if (/park|grass|wood|forest/.test(l.id) && l.type === 'fill') set(l.id, 'fill-color', '#c9ecc1');
    if (/^building/.test(l.id) && l.type === 'fill') set(l.id, 'fill-color', '#e8e9ed');
  });
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function OpenMapCanvas({ center, zoom = 13, markers = [], paths = [], onMapClick, fitPoints, fitKey, fitPadding = 56, panTo, interactive = true, gestures = 'cooperative', onReady }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef(new Map()); // id -> { marker, html, draggable, props }
  const loaded = useRef(false);
  const latest = useRef({ paths, onMapClick });
  latest.current = { paths, onMapClick };

  // Create the map once.
  useEffect(() => {
    const map = new MlMap({
      container: container.current,
      style: STYLE,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
      interactive,
      dragRotate: false,
      pitchWithRotate: false,
      // Inside a scrolling page: two fingers (or Ctrl + scroll) move the map, so the page still scrolls.
      cooperativeGestures: gestures === 'cooperative',
      fadeDuration: 150,
    });
    map.touchZoomRotate?.disableRotation?.();
    // A map whose style never arrives is a blank grey box: report it so pages fall back (search,
    // "use my location", optional pin) instead of asking people to tap something they can't see.
    let styleLoaded = false;
    const styleTimer = setTimeout(() => { if (!styleLoaded) markOpenMapFailed('timed out', { retryable: true }); }, STYLE_TIMEOUT_MS);
    map.on('style.load', () => { styleLoaded = true; clearTimeout(styleTimer); });
    map.on('error', (e) => { if (!styleLoaded && !e.sourceId) markOpenMapFailed(e.error?.message || 'style error', { retryable: true }); });
    map.on('click', (e) => { if (loaded.current) latest.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    // Keyboard: arrows pan, +/- zoom (built in); Enter picks the point at the centre of the map.
    map.getCanvas().addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !loaded.current || !latest.current.onMapClick) return;
      e.preventDefault();
      const c = map.getCenter();
      latest.current.onMapClick({ lat: c.lat, lng: c.lng });
    });
    map.on('load', () => {
      googleTint(map);
      map.addSource(PATHS_SOURCE, { type: 'geojson', data: toGeoJson(latest.current.paths) });
      map.addLayer({
        id: 'anv-path-solid', type: 'line', source: PATHS_SOURCE, filter: ['!', ['get', 'dashed']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: 'anv-path-dashed', type: 'line', source: PATHS_SOURCE, filter: ['get', 'dashed'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-dasharray': [0.1, 2.4] },
      });
      loaded.current = true;
      onReady?.();
    });
    // Keep the canvas in step with its box (page transitions, responsive layouts, drawers).
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    // Start with the attribution collapsed to the small (i) button, like Google's map chrome.
    map.once('idle', () => container.current?.querySelector('.maplibregl-ctrl-attrib')?.removeAttribute('open'));
    mapRef.current = map;
    const refs = markerRefs.current;
    return () => {
      clearTimeout(styleTimer);
      resize.disconnect();
      refs.forEach(({ marker }) => marker.remove());
      refs.clear();
      loaded.current = false;
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep HTML markers in sync (position, artwork, drag and click handlers).
  useEffect(() => {
    const map = mapRef.current;
    const refs = markerRefs.current;
    const seen = new Set();
    markers.filter((m) => m.position).forEach((m) => {
      seen.add(m.id);
      const geo = MARKER_GEOMETRY[m.kind] || MARKER_GEOMETRY.destination;
      const html = markerHtml(m.kind, { label: m.label, heading: m.heading, status: m.status, title: m.title, stale: m.stale });
      let entry = refs.get(m.id);
      if (!entry) {
        const el = document.createElement('div');
        el.style.width = `${geo.size[0]}px`;
        el.style.height = `${geo.size[1]}px`;
        const marker = new Marker({ element: el, anchor: 'top-left', offset: [-geo.anchor[0], -geo.anchor[1]], draggable: !!m.draggable })
          .setLngLat([m.position.lng, m.position.lat]).addTo(map);
        entry = { marker, el, html: null, props: m };
        // Clicking a marker shouldn't also count as a click on the map underneath.
        el.addEventListener('click', (e) => { e.stopPropagation(); entry.props.onClick?.(); });
        marker.on('dragend', () => { const p = marker.getLngLat(); entry.props.onDragEnd?.({ lat: p.lat, lng: p.lng }); });
        refs.set(m.id, entry);
      }
      entry.props = m;
      entry.marker.setLngLat([m.position.lng, m.position.lat]);
      entry.marker.setDraggable(!!m.draggable);
      if (entry.html !== html) { entry.el.innerHTML = html; entry.html = html; }
      entry.el.style.zIndex = String(m.zIndex || 0);
      entry.el.style.cursor = m.onClick ? 'pointer' : m.draggable ? 'grab' : '';
      // The map allows page scrolling on touch (cooperative gestures); a finger on a draggable pin
      // must move the pin, not scroll the page.
      entry.el.style.touchAction = m.draggable ? 'none' : '';
      if (m.title) entry.el.setAttribute('aria-label', m.title);
    });
    refs.forEach((entry, id) => { if (!seen.has(id)) { entry.marker.remove(); refs.delete(id); } });
  }, [markers]);

  // Route lines.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded.current) return;
    map.getSource(PATHS_SOURCE)?.setData(toGeoJson(paths));
  }, [paths]);

  // Fit the camera when asked.
  useEffect(() => {
    const map = mapRef.current;
    const pts = (fitPoints || []).filter(Boolean);
    if (!map || pts.length === 0) return;
    const duration = reducedMotion() ? 0 : 700;
    if (pts.length === 1) map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: Math.max(map.getZoom(), 15), duration });
    else {
      const b = new LngLatBounds();
      pts.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: fitPadding, maxZoom: 16, duration });
    }
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (panTo && mapRef.current) mapRef.current.easeTo({ center: [panTo.lng, panTo.lat], duration: reducedMotion() ? 0 : 600 });
  }, [panTo?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={container} className="absolute inset-0 size-full" />;
}

function toGeoJson(paths) {
  return {
    type: 'FeatureCollection',
    features: paths.filter((p) => p.points?.length > 1).map((p) => ({
      type: 'Feature',
      properties: { color: p.color, width: p.width || 5, dashed: !!p.dashed },
      geometry: { type: 'LineString', coordinates: p.points.map((q) => [q.lng, q.lat]) },
    })),
  };
}
