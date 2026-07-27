"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceKm, haversineKm } from "@/lib/geo";
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  CircleMarker as LeafletCircleMarker,
} from "leaflet";
import type { MapProvider } from "@/lib/paths";
import "leaflet/dist/leaflet.css";

export type MapAsset = {
  id: string;
  assetNumber: string;
  name: string;
  roadName: string;
  typeLabel: string;
  latitude: number;
  longitude: number;
};

type Props = {
  assets: MapAsset[];
  provider: MapProvider;
  googleApiKey: string | null;
  nearmapApiKey: string | null;
};

type LatLng = { lat: number; lng: number };

type GMaps = {
  Map: new (el: HTMLElement, opts?: object) => GMap;
  Marker: new (opts?: object) => GMarker;
  LatLngBounds: new () => { extend: (p: LatLng) => void };
  Size: new (w: number, h: number) => { width: number; height: number };
  Point: new (x: number, y: number) => { x: number; y: number };
  SymbolPath: { CIRCLE: number };
};

type GMap = {
  panTo: (p: LatLng) => void;
  setZoom: (z: number) => void;
  getZoom: () => number | undefined;
  fitBounds: (b: { extend: (p: LatLng) => void }, opts?: object) => void;
};

type GMarker = {
  setMap: (m: GMap | null) => void;
  getPosition: () => unknown;
  setPosition?: (p: LatLng) => void;
  setIcon?: (icon: object) => void;
  addListener: (event: string, fn: () => void) => void;
};

const NEARBY_KM = 5;
const MELBOURNE: LatLng = { lat: -37.8136, lng: 144.9631 };
const MAP_PROVIDER_STORAGE_KEY = "veninspect-map-provider";

function readStoredProvider(fallback: MapProvider): MapProvider {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(MAP_PROVIDER_STORAGE_KEY);
    if (raw === "osm" || raw === "google" || raw === "nearmap") return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

function storeProvider(p: MapProvider) {
  try {
    localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

function markerLabel(assetNumber: string): string {
  const t = assetNumber.trim();
  if (t.length <= 6) return t;
  return t.slice(0, 6);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Green teardrop pin with asset number (for Leaflet DivIcon + Google icon URL). */
function assetPinSvg(label: string, selected: boolean): string {
  const fill = selected ? "#2bb673" : "#00994d";
  const ring = selected ? "#ffffff" : "#004825";
  const text = escapeHtml(markerLabel(label));
  const fontSize = text.length > 4 ? 9 : 11;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
  <path d="M22 52C22 52 40 35.5 40 20.5a18 18 0 1 0-36 0C4 35.5 22 52 22 52z" fill="${fill}" stroke="${ring}" stroke-width="2"/>
  <text x="22" y="25" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${text}</text>
</svg>`;
}

function assetPinDataUrl(label: string, selected: boolean): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(assetPinSvg(label, selected))}`;
}

function getGoogleMaps(): GMaps | null {
  const g = (window as unknown as { google?: { maps?: GMaps } }).google;
  return g?.maps ?? null;
}

function loadGoogleMaps(apiKey: string): Promise<GMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const existing = getGoogleMaps();
  if (existing) return Promise.resolve(existing);

  const scriptSel = 'script[data-veninspect-maps="1"]';
  const existingScript = document.querySelector<HTMLScriptElement>(scriptSel);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      const tick = () => {
        const maps = getGoogleMaps();
        if (maps) resolve(maps);
        else setTimeout(tick, 50);
      };
      existingScript.addEventListener("error", () =>
        reject(new Error("Google Maps failed to load")),
      );
      tick();
    });
  }

  return new Promise((resolve, reject) => {
    const w = window as unknown as {
      __veninspectMapsReady?: () => void;
      gm_authFailure?: () => void;
    };
    w.__veninspectMapsReady = () => {
      const maps = getGoogleMaps();
      if (maps) resolve(maps);
      else reject(new Error("Google Maps loaded but API missing"));
    };
    w.gm_authFailure = () => {
      reject(
        new Error(
          "Google Maps API key rejected (billing, referrer, or Maps JavaScript API).",
        ),
      );
    };
    const script = document.createElement("script");
    script.dataset.veninspectMaps = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=__veninspectMapsReady`;
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(script);
  });
}

async function initLeafletIcons() {
  const L = await import("leaflet");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  return L;
}

/** Leaflet breaks pan/tiles if created at 0×0 — wait for the shell to lay out. */
async function waitForMapSize(
  el: HTMLElement,
  isCancelled: () => boolean,
  maxMs = 2500,
): Promise<boolean> {
  const start = performance.now();
  while (performance.now() - start < maxMs) {
    if (isCancelled()) return false;
    if (el.clientWidth >= 40 && el.clientHeight >= 40) return true;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return el.clientWidth > 0 && el.clientHeight > 0;
}

function refreshLeafletSize(map: LeafletMap | null) {
  if (!map) return;
  map.invalidateSize({ animate: false });
  // Re-assert pan after size/layout settles (Leaflet can leave handlers odd at 0×0).
  map.dragging.enable();
}

export function AssetMap({
  assets,
  provider,
  googleApiKey,
  nearmapApiKey,
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const leafletMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const leafletUserRef = useRef<LeafletCircleMarker | null>(null);
  const googleMapRef = useRef<GMap | null>(null);
  const googleMarkersRef = useRef<Map<string, GMarker>>(new Map());
  const googleUserRef = useRef<GMarker | null>(null);
  const engineRef = useRef<"leaflet" | "google" | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<MapProvider>(provider);
  const [activeProvider, setActiveProvider] = useState<MapProvider>(provider);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRootRef = useRef<HTMLDivElement>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  selectedIdRef.current = selectedId;

  // Resolve browser layer preference before the first map init (avoids create→destroy).
  useEffect(() => {
    setSelectedProvider(readStoredProvider(provider));
    setPrefsReady(true);
  }, [provider]);

  useEffect(() => {
    if (!layersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = layersRootRef.current;
      if (root && !root.contains(event.target as Node)) {
        setLayersOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLayersOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [layersOpen]);

  const withCoords = useMemo(
    () =>
      assets.filter(
        (a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude),
      ),
    [assets],
  );

  const selectedAsset = useMemo(
    () => withCoords.find((a) => a.id === selectedId) ?? null,
    [selectedId, withCoords],
  );

  const nearby = useMemo(() => {
    if (!userPos) return [];
    return withCoords
      .map((a) => ({
        asset: a,
        km: haversineKm(userPos.lat, userPos.lng, a.latitude, a.longitude),
      }))
      .filter((x) => x.km <= NEARBY_KM)
      .sort((a, b) => a.km - b.km);
  }, [userPos, withCoords]);

  const typeOptions = useMemo(() => {
    const labels = new Set(withCoords.map((a) => a.typeLabel));
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [withCoords]);

  const isFiltering = query.trim().length > 0 || typeFilter !== "all";

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    return withCoords.filter((a) => {
      if (typeFilter !== "all" && a.typeLabel !== typeFilter) return false;
      if (!term) return true;
      return (
        a.assetNumber.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        a.roadName.toLowerCase().includes(term) ||
        a.typeLabel.toLowerCase().includes(term)
      );
    });
  }, [withCoords, query, typeFilter]);

  /** List shown in the panel: search hits when filtering, else nearby (or empty prompt). */
  const panelList = useMemo(() => {
    if (isFiltering) {
      return searchResults.slice(0, 80).map((asset) => ({
        asset,
        km: userPos
          ? haversineKm(userPos.lat, userPos.lng, asset.latitude, asset.longitude)
          : null,
      }));
    }
    if (userPos) {
      return nearby.map(({ asset, km }) => ({ asset, km }));
    }
    return [];
  }, [isFiltering, searchResults, nearby, userPos]);

  const tearDown = useCallback(() => {
    leafletMarkersRef.current.clear();
    leafletUserRef.current = null;
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }
    for (const m of googleMarkersRef.current.values()) m.setMap(null);
    googleMarkersRef.current.clear();
    if (googleUserRef.current) {
      googleUserRef.current.setMap(null);
      googleUserRef.current = null;
    }
    googleMapRef.current = null;
    engineRef.current = null;
    const el = mapEl.current;
    if (el) {
      el.innerHTML = "";
      // Leaflet stamps the container; clear so a remount can re-init cleanly.
      delete (el as unknown as { _leaflet_id?: number })._leaflet_id;
    }
  }, []);

  const initLeaflet = useCallback(
    async (mode: "osm" | "nearmap", isCancelled: () => boolean) => {
      const el = mapEl.current;
      if (!el || isCancelled()) return;
      const sized = await waitForMapSize(el, isCancelled);
      if (!sized || isCancelled() || mapEl.current !== el) return;

      const L = await initLeafletIcons();
      if (isCancelled() || mapEl.current !== el) return;

      delete (el as unknown as { _leaflet_id?: number })._leaflet_id;
      el.innerHTML = "";

      const center =
        withCoords.length > 0
          ? { lat: withCoords[0]!.latitude, lng: withCoords[0]!.longitude }
          : MELBOURNE;

      const map = L.map(el, {
        center: [center.lat, center.lng],
        zoom: withCoords.length ? 11 : 10,
        dragging: true,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
      });

      if (isCancelled()) {
        map.remove();
        return;
      }

      const tileOpts = {
        detectRetina: false as const,
        keepBuffer: 4,
        updateWhenZooming: false,
      };

      if (mode === "nearmap" && nearmapApiKey) {
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          opacity: 0.45,
          ...tileOpts,
        }).addTo(map);
        L.tileLayer(
          `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg?apikey=${encodeURIComponent(nearmapApiKey)}`,
          {
            attribution:
              '&copy; <a href="https://www.nearmap.com/">Nearmap</a>',
            maxZoom: 21,
            maxNativeZoom: 21,
            className: "veninspect-nearmap-tiles",
            ...tileOpts,
          },
        ).addTo(map);
      } else {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          ...tileOpts,
        }).addTo(map);
      }

      leafletMapRef.current = map;
      engineRef.current = "leaflet";
      leafletMarkersRef.current.clear();

      for (const asset of withCoords) {
        const selected = selectedIdRef.current === asset.id;
        const icon = L.divIcon({
          className: "veninspect-asset-marker",
          html: `<div class="veninspect-pin${selected ? " is-selected" : ""}" title="${escapeHtml(asset.assetNumber)}">${assetPinSvg(asset.assetNumber, selected)}</div>`,
          iconSize: [44, 54],
          iconAnchor: [22, 52],
        });
        const marker = L.marker([asset.latitude, asset.longitude], {
          icon,
          title: asset.assetNumber,
          riseOnHover: true,
          bubblingMouseEvents: true,
        }).addTo(map);
        marker.on("click", () => setSelectedId(asset.id));
        leafletMarkersRef.current.set(asset.id, marker);
      }

      if (withCoords.length > 1) {
        const bounds = L.latLngBounds(
          withCoords.map((a) => [a.latitude, a.longitude] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [40, 40], animate: false });
      }

      refreshLeafletSize(map);
      requestAnimationFrame(() => refreshLeafletSize(map));
      window.setTimeout(() => {
        if (!isCancelled()) refreshLeafletSize(map);
      }, 100);
      window.setTimeout(() => {
        if (!isCancelled()) refreshLeafletSize(map);
      }, 400);
    },
    [nearmapApiKey, withCoords],
  );

  const initGoogle = useCallback(
    async (isCancelled: () => boolean) => {
      if (!mapEl.current || !googleApiKey) {
        throw new Error("Google Maps key missing");
      }
      const sized = await waitForMapSize(mapEl.current, isCancelled);
      if (!sized || isCancelled()) return;

      const maps = await loadGoogleMaps(googleApiKey);
      if (isCancelled() || !mapEl.current) return;

      const center =
        withCoords.length > 0
          ? { lat: withCoords[0]!.latitude, lng: withCoords[0]!.longitude }
          : MELBOURNE;

      const map = new maps.Map(mapEl.current, {
        center,
        zoom: withCoords.length ? 11 : 10,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
        draggable: true,
      });
      if (isCancelled()) return;

      googleMapRef.current = map;
      engineRef.current = "google";
      googleMarkersRef.current.clear();

      for (const asset of withCoords) {
        const selected = selectedIdRef.current === asset.id;
        const marker = new maps.Marker({
          map,
          position: { lat: asset.latitude, lng: asset.longitude },
          title: asset.assetNumber,
          icon: {
            url: assetPinDataUrl(asset.assetNumber, selected),
            scaledSize: new maps.Size(44, 54),
            anchor: new maps.Point(22, 52),
          },
        });
        marker.addListener("click", () => setSelectedId(asset.id));
        googleMarkersRef.current.set(asset.id, marker);
      }

      if (withCoords.length > 1) {
        const bounds = new maps.LatLngBounds();
        for (const a of withCoords) {
          bounds.extend({ lat: a.latitude, lng: a.longitude });
        }
        map.fitBounds(bounds, { padding: 40 });
      }
    },
    [googleApiKey, withCoords],
  );

  useEffect(() => {
    if (!prefsReady) return;

    let cancelled = false;
    const isCancelled = () => cancelled;

    setMapReady(false);
    setMapError(null);
    setFallbackNote(null);
    setActiveProvider(selectedProvider);

    (async () => {
      try {
        // Only effect cleanup may destroy maps. Stale async must never tearDown —
        // that was wiping the live map right after first load.
        tearDown();
        if (cancelled || !mapEl.current) return;

        if (selectedProvider === "google") {
          if (!googleApiKey) {
            setFallbackNote(
              "Google Maps selected but no API key — using OpenStreetMap.",
            );
            setActiveProvider("osm");
            await initLeaflet("osm", isCancelled);
          } else {
            try {
              await initGoogle(isCancelled);
              if (cancelled) return;
              setActiveProvider("google");
            } catch (e) {
              if (cancelled) return;
              const msg =
                e instanceof Error ? e.message : "Google Maps failed to load";
              setFallbackNote(`${msg} Falling back to OpenStreetMap.`);
              setActiveProvider("osm");
              tearDown();
              if (cancelled) return;
              await initLeaflet("osm", isCancelled);
            }
          }
        } else if (selectedProvider === "nearmap") {
          if (!nearmapApiKey) {
            setFallbackNote(
              "Nearmap selected but no API key — using OpenStreetMap.",
            );
            setActiveProvider("osm");
            await initLeaflet("osm", isCancelled);
          } else {
            setActiveProvider("nearmap");
            await initLeaflet("nearmap", isCancelled);
          }
        } else {
          setActiveProvider("osm");
          await initLeaflet("osm", isCancelled);
        }

        if (cancelled) return;
        setMapReady(true);
        setMapError(null);
        refreshLeafletSize(leafletMapRef.current);
      } catch (e) {
        if (cancelled) return;
        setMapError(
          e instanceof Error ? e.message : "Could not initialise map",
        );
      }
    })();

    return () => {
      cancelled = true;
      tearDown();
    };
    // Recreate when provider/keys/asset set change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefsReady,
    selectedProvider,
    googleApiKey,
    nearmapApiKey,
    withCoords.map((a) => a.id).join(","),
  ]);

  const chooseProvider = useCallback((next: MapProvider) => {
    if (next === "google" && !googleApiKey) return;
    if (next === "nearmap" && !nearmapApiKey) return;
    storeProvider(next);
    setSelectedProvider(next);
    setLayersOpen(false);
  }, [googleApiKey, nearmapApiKey]);

  useEffect(() => {
    if (!mapReady || !userPos) return;
    void (async () => {
      if (engineRef.current === "leaflet" && leafletMapRef.current) {
        const L = await import("leaflet");
        if (!leafletUserRef.current) {
          const marker = L.circleMarker([userPos.lat, userPos.lng], {
            radius: 8,
            color: "#ffffff",
            weight: 2,
            fillColor: "#0077c8",
            fillOpacity: 1,
          }).addTo(leafletMapRef.current);
          marker.bindPopup("Your location");
          leafletUserRef.current = marker;
        } else {
          leafletUserRef.current.setLatLng([userPos.lat, userPos.lng]);
        }
        leafletMapRef.current.panTo([userPos.lat, userPos.lng]);
        if (leafletMapRef.current.getZoom() < 13) {
          leafletMapRef.current.setZoom(14);
        }
        return;
      }
      if (engineRef.current === "google" && googleMapRef.current) {
        const maps = getGoogleMaps();
        if (!maps) return;
        if (!googleUserRef.current) {
          googleUserRef.current = new maps.Marker({
            map: googleMapRef.current,
            position: userPos,
            title: "Your location",
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#0077c8",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
        } else if (googleUserRef.current.setPosition) {
          googleUserRef.current.setPosition(userPos);
        } else {
          googleUserRef.current.setMap(null);
          googleUserRef.current = new maps.Marker({
            map: googleMapRef.current,
            position: userPos,
            title: "Your location",
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#0077c8",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
        }
        googleMapRef.current.panTo(userPos);
        const z = googleMapRef.current.getZoom();
        if (z == null || z < 13) googleMapRef.current.setZoom(14);
      }
    })();
  }, [userPos, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapEl.current) return;
    const el = mapEl.current;
    const notifySize = () => {
      leafletMapRef.current?.invalidateSize({ animate: false });
      if (engineRef.current === "google" && googleMapRef.current) {
        const g = (
          window as unknown as {
            google?: { maps?: { event?: { trigger: (t: unknown, e: string) => void } } };
          }
        ).google;
        g?.maps?.event?.trigger(googleMapRef.current, "resize");
      }
    };
    const ro = new ResizeObserver(() => notifySize());
    ro.observe(el);
    window.addEventListener("orientationchange", notifySize);
    // After layout settles (nav/footer)
    const t = window.setTimeout(notifySize, 120);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", notifySize);
      window.clearTimeout(t);
    };
  }, [mapReady]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Location is not supported in this browser.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — enable it for nearby assets."
            : "Could not get your location. Try again outdoors.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, []);

  useEffect(() => {
    locateMe();
  }, [locateMe]);

  // Keep pin styles in sync with selection (no Leaflet popups — those break drag after link clicks).
  useEffect(() => {
    if (!mapReady) return;
    void (async () => {
      if (engineRef.current === "leaflet") {
        const L = await import("leaflet");
        for (const asset of withCoords) {
          const marker = leafletMarkersRef.current.get(asset.id);
          if (!marker) continue;
          const selected = asset.id === selectedId;
          marker.setIcon(
            L.divIcon({
              className: "veninspect-asset-marker",
              html: `<div class="veninspect-pin${selected ? " is-selected" : ""}" title="${escapeHtml(asset.assetNumber)}">${assetPinSvg(asset.assetNumber, selected)}</div>`,
              iconSize: [44, 54],
              iconAnchor: [22, 52],
            }),
          );
        }
        return;
      }
      if (engineRef.current === "google") {
        const maps = getGoogleMaps();
        if (!maps) return;
        for (const asset of withCoords) {
          const marker = googleMarkersRef.current.get(asset.id);
          if (!marker?.setIcon) continue;
          const selected = asset.id === selectedId;
          marker.setIcon({
            url: assetPinDataUrl(asset.assetNumber, selected),
            scaledSize: new maps.Size(44, 54),
            anchor: new maps.Point(22, 52),
          });
        }
      }
    })();
  }, [selectedId, mapReady, withCoords]);

  // Dim pins that don't match the active search/filter.
  useEffect(() => {
    if (!mapReady) return;
    const matchIds = new Set(searchResults.map((a) => a.id));
    for (const [id, marker] of leafletMarkersRef.current) {
      const el = marker.getElement();
      if (!el) continue;
      const on = !isFiltering || matchIds.has(id);
      el.style.opacity = on ? "1" : "0.22";
      el.style.pointerEvents = on ? "" : "none";
    }
    for (const [id, marker] of googleMarkersRef.current) {
      const on = !isFiltering || matchIds.has(id);
      const m = marker as GMarker & { setOpacity?: (n: number) => void };
      m.setOpacity?.(on ? 1 : 0.22);
    }
  }, [mapReady, searchResults, isFiltering]);

  const focusAsset = (asset: MapAsset) => {
    setSelectedId(asset.id);
    if (engineRef.current === "leaflet" && leafletMapRef.current) {
      leafletMapRef.current.panTo([asset.latitude, asset.longitude]);
      if (leafletMapRef.current.getZoom() < 15) {
        leafletMapRef.current.setZoom(16);
      }
      return;
    }
    if (engineRef.current === "google" && googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: asset.latitude,
        lng: asset.longitude,
      });
      const z = googleMapRef.current.getZoom();
      if (z == null || z < 15) googleMapRef.current.setZoom(16);
    }
  };

  const providerLabel =
    activeProvider === "google"
      ? "Google Maps"
      : activeProvider === "nearmap"
        ? "Nearmap aerial"
        : "OpenStreetMap";

  if (mapError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
        <p className="font-medium">Map failed to load</p>
        <p className="mt-2">{mapError}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="rounded-xl bg-[color:var(--ventia-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
        <span className="text-xs text-[color:var(--ventia-muted)]">
          {withCoords.length} mapped
          {assets.length - withCoords.length > 0
            ? ` · ${assets.length - withCoords.length} without coords`
            : ""}
        </span>
      </div>

      {fallbackNote || locError || withCoords.length === 0 ? (
        <div className="space-y-2">
          {fallbackNote ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {fallbackNote}
            </p>
          ) : null}
          {locError ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {locError}
            </p>
          ) : null}
          {withCoords.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              No assets have coordinates yet. Admins: set lat/long under{" "}
              <Link href="/manage/assets" className="font-semibold underline">
                Admin → Assets
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Map owns a stable viewport — search/results overlay it (do not push height). */}
      <div className="relative z-0 min-h-[280px] w-full flex-1 overflow-hidden rounded-2xl border border-[color:var(--ventia-border)]">
        <div
          ref={mapEl}
          className="absolute inset-0 z-0 h-full w-full touch-none bg-[#e5e3df] [&.leaflet-container]:h-full [&.leaflet-container]:w-full [&.leaflet-container]:touch-none"
          role="region"
          aria-label="Asset map"
        />

        {/* Layers — top-right, clear of the search / results panels */}
        <div
          ref={layersRootRef}
          className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col items-end gap-2"
        >
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-black/10 bg-[color:var(--panel)]/92 py-1.5 pl-1.5 pr-3 text-[color:var(--ventia-ink)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:bg-[color:var(--panel)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ventia-green)] dark:border-white/10"
            aria-expanded={layersOpen}
            aria-haspopup="menu"
            aria-label={`Map layers — ${providerLabel}`}
            title={`Layers · ${providerLabel}`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--ventia-green)] text-white shadow-sm">
              <LayersIcon />
            </span>
            <span className="pr-0.5 text-left leading-tight">
              <span className="block text-xs font-semibold tracking-wide">
                Layers
              </span>
              <span className="block max-w-[7.5rem] truncate text-[11px] font-medium text-[color:var(--ventia-muted)]">
                {providerLabel}
              </span>
            </span>
            <ChevronIcon open={layersOpen} />
          </button>

          {layersOpen ? (
            <div
              className="pointer-events-auto w-[min(17.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-black/10 bg-[color:var(--panel)]/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-md dark:border-white/10 dark:bg-[#1c2128]/95"
              role="menu"
              aria-label="Map basemap"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ventia-muted)]">
                Basemap
              </p>
              <MapLayerTile
                label="Streets"
                description="OpenStreetMap"
                active={activeProvider === "osm"}
                logoSrc="/brand/map/openstreetmap.svg"
                logoAlt="OpenStreetMap"
                onClick={() => chooseProvider("osm")}
              />
              <MapLayerTile
                label="Google"
                description={
                  googleApiKey ? "Google Maps" : "Key not configured"
                }
                active={activeProvider === "google"}
                disabled={!googleApiKey}
                logoSrc="/brand/map/google-maps.svg"
                logoAlt="Google Maps"
                onClick={() => chooseProvider("google")}
                title={
                  googleApiKey
                    ? "Google Maps"
                    : "Google Maps key not configured (Admin → System → Maps)"
                }
              />
              <MapLayerTile
                label="Nearmap"
                description={
                  nearmapApiKey ? "Aerial imagery" : "Key not configured"
                }
                active={activeProvider === "nearmap"}
                disabled={!nearmapApiKey}
                logoSrc="/brand/map/nearmap.png"
                logoAlt="Nearmap"
                onClick={() => chooseProvider("nearmap")}
                title={
                  nearmapApiKey
                    ? "Nearmap aerial"
                    : "Nearmap key not configured (Admin → System → Maps)"
                }
              />
            </div>
          ) : null}
        </div>

        {/* Desktop: side results panel */}
        <aside className="pointer-events-none absolute inset-y-0 left-0 z-[450] hidden w-[min(22rem,42%)] p-3 md:flex">
          <MapResultsPanel
            className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]/95 shadow-lg backdrop-blur-sm"
            query={query}
            setQuery={setQuery}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            typeOptions={typeOptions}
            isFiltering={isFiltering}
            panelList={panelList}
            selectedAsset={selectedAsset}
            selectedId={selectedId}
            userPos={userPos}
            onFocus={focusAsset}
            onClearSelection={() => setSelectedId(null)}
          />
        </aside>

        {/* Mobile: bottom results sheet — overlays map, does not shrink it */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[450] md:hidden">
          <MapResultsPanel
            className="pointer-events-auto flex max-h-[min(42dvh,22rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[color:var(--ventia-border)] bg-[color:var(--panel)]/95 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm"
            query={query}
            setQuery={setQuery}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            typeOptions={typeOptions}
            isFiltering={isFiltering}
            panelList={panelList}
            selectedAsset={selectedAsset}
            selectedId={selectedId}
            userPos={userPos}
            onFocus={focusAsset}
            onClearSelection={() => setSelectedId(null)}
            mobile
          />
        </div>
      </div>
    </div>
  );
}

type PanelRow = { asset: MapAsset; km: number | null };

function MapResultsPanel({
  className,
  query,
  setQuery,
  typeFilter,
  setTypeFilter,
  typeOptions,
  isFiltering,
  panelList,
  selectedAsset,
  selectedId,
  userPos,
  onFocus,
  onClearSelection,
  mobile = false,
}: {
  className?: string;
  query: string;
  setQuery: (q: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  typeOptions: string[];
  isFiltering: boolean;
  panelList: PanelRow[];
  selectedAsset: MapAsset | null;
  selectedId: string | null;
  userPos: LatLng | null;
  onFocus: (asset: MapAsset) => void;
  onClearSelection: () => void;
  mobile?: boolean;
}) {
  return (
    <div className={className}>
      {mobile ? (
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[color:var(--ventia-border)]"
          aria-hidden
        />
      ) : null}

      <div className="shrink-0 space-y-2 border-b border-[color:var(--ventia-border)] p-3">
        <label className="block">
          <span className="sr-only">Search assets</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, name, or road…"
            className="field-input w-full text-sm"
            autoComplete="off"
          />
        </label>
        {typeOptions.length > 1 ? (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="field-input w-full text-sm"
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : null}
        <p className="text-xs text-[color:var(--ventia-muted)]">
          {isFiltering
            ? `${panelList.length} match${panelList.length === 1 ? "" : "es"}`
            : userPos
              ? `Nearby (within ${NEARBY_KM} km)`
              : "Type to search the registry"}
        </p>
      </div>

      {selectedAsset ? (
        <div className="shrink-0 space-y-2 border-b border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)]/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-[color:var(--ventia-green)]">
                {selectedAsset.assetNumber}
              </p>
              <p className="truncate text-xs text-[color:var(--ventia-muted)]">
                {selectedAsset.name} · {selectedAsset.roadName}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs text-[color:var(--ventia-muted)] underline-offset-2 hover:underline"
              onClick={onClearSelection}
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/inspect?assetId=${encodeURIComponent(selectedAsset.id)}`}
              className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Start inspection
            </Link>
            <Link
              href={`/assets/${selectedAsset.id}`}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-ink)]"
            >
              Open
            </Link>
          </div>
        </div>
      ) : null}

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {panelList.length === 0 ? (
          <li className="px-3 py-4 text-sm text-[color:var(--ventia-muted)]">
            {isFiltering
              ? "No assets match that search."
              : userPos
                ? `No mapped assets within ${NEARBY_KM} km.`
                : "Search by code, name, or road — or enable location for nearby."}
          </li>
        ) : (
          panelList.map(({ asset, km }) => (
            <li
              key={asset.id}
              className={`border-b border-[color:var(--ventia-border)] last:border-b-0 ${
                selectedId === asset.id
                  ? "bg-[color:var(--ventia-green-tint)]"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onFocus(asset)}
                className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-semibold text-[color:var(--ventia-ink)]">
                    {asset.assetNumber}
                  </span>
                  <span className="block truncate text-xs text-[color:var(--ventia-muted)]">
                    {asset.name} · {asset.roadName} · {asset.typeLabel}
                  </span>
                </span>
                {km != null ? (
                  <span className="shrink-0 text-xs font-medium text-[color:var(--ventia-blue)]">
                    {formatDistanceKm(km)}
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 3 8l9 4.5L21 8l-9-4.5Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M3 12.5 12 17l9-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16.5 12 21l9-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`text-[color:var(--ventia-muted)] transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapLayerTile({
  label,
  description,
  active,
  disabled,
  logoSrc,
  logoAlt,
  onClick,
  title,
}: {
  label: string;
  description?: string;
  active: boolean;
  disabled?: boolean;
  logoSrc: string;
  logoAlt: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-[color:var(--ventia-green-tint)] ring-1 ring-[color:var(--ventia-green)]"
          : "hover:bg-[color:var(--ventia-border)]/40"
      }`}
    >
      <span
        className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white shadow-sm dark:border-white/10"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand marks in /public */}
        <img
          src={logoSrc}
          alt={logoAlt}
          className="h-[78%] w-[78%] object-contain"
          draggable={false}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[color:var(--ventia-ink)]">
          {label}
        </span>
        {description ? (
          <span className="block truncate text-[11px] text-[color:var(--ventia-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      {active ? (
        <span
          className="text-xs font-bold text-[color:var(--ventia-green)]"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}
