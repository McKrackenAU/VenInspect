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
  InfoWindow: new () => GInfoWindow;
  LatLngBounds: new () => { extend: (p: LatLng) => void };
  SymbolPath: { CIRCLE: number };
};

type GLatLng = {
  lat: number | (() => number);
  lng: number | (() => number);
};

type GMap = {
  panTo: (p: LatLng) => void;
  setZoom: (z: number) => void;
  getZoom: () => number | undefined;
  fitBounds: (b: { extend: (p: LatLng) => void }, opts?: object) => void;
};

type GMarker = {
  setMap: (m: GMap | null) => void;
  getPosition: () => GLatLng | null | undefined;
  setPosition?: (p: LatLng) => void;
  addListener: (event: string, fn: () => void) => void;
};

type GInfoWindow = {
  setContent: (html: string) => void;
  open: (opts: { map: GMap; anchor: GMarker }) => void;
};

function readLatLng(p: GLatLng): LatLng {
  const lat = typeof p.lat === "function" ? p.lat() : p.lat;
  const lng = typeof p.lng === "function" ? p.lng() : p.lng;
  return { lat, lng };
}

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

function ensureLeafletCss() {
  if (document.querySelector('link[data-veninspect-leaflet="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.dataset.veninspectLeaflet = "1";
  document.head.appendChild(link);
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

export function AssetMap({
  assets,
  provider,
  googleApiKey,
  nearmapApiKey,
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const leafletMarkersRef = useRef<LeafletMarker[]>([]);
  const leafletUserRef = useRef<LeafletCircleMarker | null>(null);
  const googleMapRef = useRef<GMap | null>(null);
  const googleMarkersRef = useRef<GMarker[]>([]);
  const googleUserRef = useRef<GMarker | null>(null);
  const googleInfoRef = useRef<GInfoWindow | null>(null);
  const engineRef = useRef<"leaflet" | "google" | null>(null);

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
  const initGenRef = useRef(0);

  // Prefer last user choice from this browser; fall back to admin default.
  useEffect(() => {
    const stored = readStoredProvider(provider);
    setSelectedProvider((prev) => (prev === stored ? prev : stored));
  }, [provider]);

  const withCoords = useMemo(
    () =>
      assets.filter(
        (a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude),
      ),
    [assets],
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

  const tearDown = useCallback(() => {
    leafletMarkersRef.current = [];
    leafletUserRef.current = null;
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }
    for (const m of googleMarkersRef.current) m.setMap(null);
    googleMarkersRef.current = [];
    if (googleUserRef.current) {
      googleUserRef.current.setMap(null);
      googleUserRef.current = null;
    }
    googleMapRef.current = null;
    googleInfoRef.current = null;
    engineRef.current = null;
    const el = mapEl.current;
    if (el) {
      el.innerHTML = "";
      // Leaflet stamps the container; clear so a remount can re-init cleanly.
      delete (el as unknown as { _leaflet_id?: number })._leaflet_id;
    }
  }, []);

  const initLeaflet = useCallback(
    async (mode: "osm" | "nearmap") => {
      const el = mapEl.current;
      if (!el) return;
      ensureLeafletCss();
      const L = await initLeafletIcons();
      // Stale async init after Strict Mode remount / provider switch.
      if (mapEl.current !== el) return;
      delete (el as unknown as { _leaflet_id?: number })._leaflet_id;
      el.innerHTML = "";

      const center =
        withCoords.length > 0
          ? { lat: withCoords[0]!.latitude, lng: withCoords[0]!.longitude }
          : MELBOURNE;

      const map = L.map(el, {
        center: [center.lat, center.lng],
        zoom: withCoords.length ? 11 : 10,
      });

      if (mode === "nearmap" && nearmapApiKey) {
        // OSM underlay for areas without Nearmap coverage / while tiles load
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          opacity: 0.35,
        }).addTo(map);
        L.tileLayer(
          `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg?apikey=${encodeURIComponent(nearmapApiKey)}`,
          {
            attribution:
              '&copy; <a href="https://www.nearmap.com/">Nearmap</a>',
            maxZoom: 21,
            maxNativeZoom: 21,
          },
        ).addTo(map);
      } else {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
      }

      leafletMapRef.current = map;
      engineRef.current = "leaflet";
      leafletMarkersRef.current = withCoords.map((asset) => {
        const marker = L.marker([asset.latitude, asset.longitude]).addTo(map);
        marker.bindPopup(
          `<strong>${asset.assetNumber}</strong><br/>${asset.name}<br/><span style="color:#5c6770">${asset.roadName} · ${asset.typeLabel}</span><br/><a href="/assets/${asset.id}">Open asset</a>`,
        );
        marker.on("click", () => setSelectedId(asset.id));
        return marker;
      });

      if (withCoords.length > 1) {
        const bounds = L.latLngBounds(
          withCoords.map((a) => [a.latitude, a.longitude] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [40, 40] });
      }
      setTimeout(() => map.invalidateSize(), 100);
    },
    [nearmapApiKey, withCoords],
  );

  const initGoogle = useCallback(async () => {
    if (!mapEl.current || !googleApiKey) {
      throw new Error("Google Maps key missing");
    }
    const maps = await loadGoogleMaps(googleApiKey);
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
    });
    const info = new maps.InfoWindow();
    googleMapRef.current = map;
    googleInfoRef.current = info;
    engineRef.current = "google";

    googleMarkersRef.current = withCoords.map((asset) => {
      const marker = new maps.Marker({
        map,
        position: { lat: asset.latitude, lng: asset.longitude },
        title: asset.assetNumber,
      });
      marker.addListener("click", () => {
        setSelectedId(asset.id);
        info.setContent(
          `<strong>${asset.assetNumber}</strong><br/>${asset.name}<br/><span style="color:#5c6770">${asset.roadName} · ${asset.typeLabel}</span><br/><a href="/assets/${asset.id}">Open asset</a>`,
        );
        info.open({ map, anchor: marker });
      });
      return marker;
    });

    if (withCoords.length > 1) {
      const bounds = new maps.LatLngBounds();
      for (const a of withCoords) {
        bounds.extend({ lat: a.latitude, lng: a.longitude });
      }
      map.fitBounds(bounds, { padding: 40 });
    }
  }, [googleApiKey, withCoords]);

  useEffect(() => {
    const gen = ++initGenRef.current;
    setMapReady(false);
    setMapError(null);
    setFallbackNote(null);
    setActiveProvider(selectedProvider);

    const stillCurrent = () => gen === initGenRef.current;

    (async () => {
      try {
        tearDown();
        if (!stillCurrent() || !mapEl.current) return;

        if (selectedProvider === "google") {
          if (!googleApiKey) {
            setFallbackNote(
              "Google Maps selected but no API key — using OpenStreetMap.",
            );
            setActiveProvider("osm");
            await initLeaflet("osm");
          } else {
            try {
              await initGoogle();
              if (!stillCurrent()) {
                tearDown();
                return;
              }
              setActiveProvider("google");
            } catch (e) {
              const msg =
                e instanceof Error ? e.message : "Google Maps failed to load";
              setFallbackNote(`${msg} Falling back to OpenStreetMap.`);
              setActiveProvider("osm");
              tearDown();
              if (!stillCurrent()) return;
              await initLeaflet("osm");
            }
          }
        } else if (selectedProvider === "nearmap") {
          if (!nearmapApiKey) {
            setFallbackNote(
              "Nearmap selected but no API key — using OpenStreetMap.",
            );
            setActiveProvider("osm");
            await initLeaflet("osm");
          } else {
            setActiveProvider("nearmap");
            await initLeaflet("nearmap");
          }
        } else {
          setActiveProvider("osm");
          await initLeaflet("osm");
        }

        // Drop work from a superseded init (Strict Mode / fast provider switch).
        if (!stillCurrent()) {
          tearDown();
          return;
        }
        setMapReady(true);
        setMapError(null);
        // Layout may still be settling (flex/absolute shell).
        requestAnimationFrame(() => {
          if (stillCurrent()) {
            leafletMapRef.current?.invalidateSize({ animate: false });
          }
        });
        window.setTimeout(() => {
          if (stillCurrent()) {
            leafletMapRef.current?.invalidateSize({ animate: false });
          }
        }, 250);
      } catch (e) {
        if (!stillCurrent()) return;
        setMapError(
          e instanceof Error ? e.message : "Could not initialise map",
        );
      }
    })();

    return () => {
      initGenRef.current += 1;
      tearDown();
    };
    // Recreate when provider/keys/asset set change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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

  const focusAsset = (asset: MapAsset) => {
    setSelectedId(asset.id);
    if (engineRef.current === "leaflet" && leafletMapRef.current) {
      leafletMapRef.current.panTo([asset.latitude, asset.longitude]);
      leafletMapRef.current.setZoom(16);
      const marker = leafletMarkersRef.current.find((m) => {
        const ll = m.getLatLng();
        return (
          Math.abs(ll.lat - asset.latitude) < 1e-6 &&
          Math.abs(ll.lng - asset.longitude) < 1e-6
        );
      });
      marker?.openPopup();
      return;
    }
    if (engineRef.current === "google" && googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: asset.latitude,
        lng: asset.longitude,
      });
      googleMapRef.current.setZoom(16);
      const marker = googleMarkersRef.current.find((m) => {
        const raw = m.getPosition();
        if (!raw) return false;
        const p = readLatLng(raw);
        return (
          Math.abs(p.lat - asset.latitude) < 1e-6 &&
          Math.abs(p.lng - asset.longitude) < 1e-6
        );
      });
      if (marker && googleInfoRef.current) {
        googleInfoRef.current.setContent(
          `<strong>${asset.assetNumber}</strong><br/>${asset.name}<br/><span style="color:#5c6770">${asset.roadName} · ${asset.typeLabel}</span><br/><a href="/assets/${asset.id}">Open asset</a>`,
        );
        googleInfoRef.current.open({
          map: googleMapRef.current,
          anchor: marker,
        });
      }
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
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
          {withCoords.length} mapped · {assets.length - withCoords.length} without
          coords
        </span>
      </div>

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
          No assets have coordinates yet — the map centres on Melbourne with no pins.
          Admins: open{" "}
          <Link href="/manage/assets" className="font-semibold underline">
            Admin → Assets
          </Link>
          , edit an asset, and set latitude / longitude.
        </p>
      ) : null}

      <div className="relative z-0 w-full flex-1 min-h-[280px] h-[clamp(280px,calc(100dvh-14rem),900px)] overflow-hidden rounded-2xl border border-[color:var(--ventia-border)]">
        {/* Absolute fill avoids h-full % bugs inside flex layouts (blank Leaflet). */}
        <div
          ref={mapEl}
          className="absolute inset-0 z-0 h-full w-full bg-[#e5e3df] [&.leaflet-container]:h-full [&.leaflet-container]:w-full"
          role="region"
          aria-label="Asset map"
        />

        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] items-end gap-2">
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            className="pointer-events-auto relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border-2 border-black/80 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ventia-green)] sm:h-20 sm:w-20"
            aria-expanded={layersOpen}
            aria-label={`Map layers — ${providerLabel}`}
            title={`Layers · ${providerLabel}`}
          >
            <span
              className="absolute inset-0 bg-[linear-gradient(135deg,#c8d8c0_0%,#a8c0d8_40%,#d8d0c0_100%)]"
              aria-hidden
            />
            <span
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent"
              aria-hidden
            />
            <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[11px] font-semibold text-white drop-shadow">
              <LayersIcon />
              Layers
            </span>
          </button>

          {layersOpen ? (
            <div className="pointer-events-auto flex items-end gap-2 overflow-x-auto rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-black/10 dark:bg-[#1c2128]/95 dark:ring-white/10">
              <MapLayerTile
                label="Streets"
                active={activeProvider === "osm"}
                previewClass="bg-[linear-gradient(135deg,#dce8d4_0%,#c5d4e8_45%,#e8e0d0_100%)]"
                onClick={() => chooseProvider("osm")}
              />
              <MapLayerTile
                label="Google"
                active={activeProvider === "google"}
                disabled={!googleApiKey}
                previewClass="bg-[linear-gradient(135deg,#1a3a2a_0%,#3d5a3a_40%,#8a7a4a_100%)]"
                onClick={() => chooseProvider("google")}
                title={
                  googleApiKey
                    ? "Google Maps"
                    : "Google Maps key not configured (Admin → System → Maps)"
                }
              />
              <MapLayerTile
                label="Nearmap"
                active={activeProvider === "nearmap"}
                disabled={!nearmapApiKey}
                previewClass="bg-[linear-gradient(135deg,#2a4a3a_0%,#5a6a3a_35%,#8a7040_70%,#c4a86a_100%)]"
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
      </div>

      {userPos ? (
        <section className="space-y-2 shrink-0">
          <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
            Nearby (within {NEARBY_KM} km)
          </h2>
          {nearby.length === 0 ? (
            <p className="text-sm text-[color:var(--ventia-muted)]">
              No mapped assets within {NEARBY_KM} km of your location.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
              {nearby.map(({ asset, km }) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => focusAsset(asset)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[color:var(--ventia-green-tint)] ${
                      selectedId === asset.id
                        ? "bg-[color:var(--ventia-green-tint)]"
                        : ""
                    }`}
                  >
                    <span>
                      <span className="block font-semibold text-[color:var(--ventia-ink)]">
                        {asset.assetNumber}
                      </span>
                      <span className="block text-sm text-[color:var(--ventia-muted)]">
                        {asset.name} · {asset.roadName}
                      </span>
                      <Link
                        href={`/assets/${asset.id}`}
                        className="mt-1 inline-block text-xs font-semibold text-[color:var(--ventia-green)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open →
                      </Link>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[color:var(--ventia-blue)]">
                      {formatDistanceKm(km)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function MapLayerTile({
  label,
  active,
  disabled,
  previewClass,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  previewClass: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "ring-2 ring-[color:var(--ventia-green)]" : ""
      }`}
    >
      <span
        className={`block h-12 w-full rounded-lg border border-black/15 shadow-sm ${previewClass}`}
      />
      <span className="text-[10px] font-semibold text-[color:var(--ventia-ink)]">
        {label}
      </span>
    </button>
  );
}
