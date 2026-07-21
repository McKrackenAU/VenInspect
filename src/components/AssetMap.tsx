"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceKm, haversineKm } from "@/lib/geo";

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
  apiKey: string | null;
};

type LatLng = { lat: number; lng: number };

type GMaps = {
  Map: new (el: HTMLElement, opts?: object) => GMap;
  Marker: new (opts?: object) => GMarker;
  InfoWindow: new () => GInfoWindow;
  LatLngBounds: new () => { extend: (p: LatLng) => void };
  SymbolPath: { CIRCLE: number };
};

type GMap = {
  panTo: (p: LatLng) => void;
  setZoom: (z: number) => void;
  getZoom: () => number | undefined;
  fitBounds: (b: { extend: (p: LatLng) => void }, padding?: number) => void;
};

type GMarker = {
  setMap: (m: GMap | null) => void;
  setPosition: (p: LatLng) => void;
  getTitle: () => string | undefined;
  addListener: (event: string, handler: () => void) => void;
};

type GInfoWindow = {
  setContent: (html: string) => void;
  open: (opts: { map: GMap; anchor?: GMarker }) => void;
};

function getMaps(): GMaps | null {
  const g = (window as unknown as { google?: { maps?: GMaps } }).google;
  return g?.maps ?? null;
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (getMaps()) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-veninspect-maps="1"]',
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps failed to load")),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.veninspectMaps = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

const NEARBY_KM = 5;

export function AssetMap({ assets, apiKey }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markersRef = useRef<GMarker[]>([]);
  const userMarkerRef = useRef<GMarker | null>(null);
  const infoRef = useRef<GInfoWindow | null>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const withCoords = useMemo(
    () => assets.filter((a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude)),
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

  useEffect(() => {
    if (!apiKey) {
      setMapsError("missing-key");
      return;
    }
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) setMapsReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapsError("load-failed");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const maps = getMaps();
    if (!mapsReady || !mapEl.current || !maps) return;

    const center =
      withCoords.length > 0
        ? { lat: withCoords[0]!.latitude, lng: withCoords[0]!.longitude }
        : { lat: -37.8136, lng: 144.9631 };

    const map = new maps.Map(mapEl.current, {
      center,
      zoom: withCoords.length ? 11 : 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });
    mapRef.current = map;
    infoRef.current = new maps.InfoWindow();

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = withCoords.map((asset) => {
      const marker = new maps.Marker({
        map,
        position: { lat: asset.latitude, lng: asset.longitude },
        title: `${asset.assetNumber} — ${asset.name}`,
      });
      marker.addListener("click", () => {
        setSelectedId(asset.id);
        infoRef.current?.setContent(
          `<div style="font:14px/1.4 system-ui,sans-serif;max-width:220px">
            <strong>${asset.assetNumber}</strong><br/>
            ${asset.name}<br/>
            <span style="color:#5c6770">${asset.roadName} · ${asset.typeLabel}</span><br/>
            <a href="/assets/${asset.id}" style="color:#004825;font-weight:600">Open asset</a>
           </div>`,
        );
        infoRef.current?.open({ map, anchor: marker });
      });
      return marker;
    });

    if (withCoords.length > 1) {
      const bounds = new maps.LatLngBounds();
      withCoords.forEach((a) => bounds.extend({ lat: a.latitude, lng: a.longitude }));
      map.fitBounds(bounds, 48);
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [mapsReady, withCoords]);

  useEffect(() => {
    const maps = getMaps();
    if (!mapsReady || !mapRef.current || !maps || !userPos) return;
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maps.Marker({
        map: mapRef.current,
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
        zIndex: 999,
      });
    } else {
      userMarkerRef.current.setPosition(userPos);
    }
    mapRef.current.panTo(userPos);
    if ((mapRef.current.getZoom() ?? 0) < 13) mapRef.current.setZoom(14);
  }, [userPos, mapsReady]);

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
    if (!mapRef.current) return;
    mapRef.current.panTo({ lat: asset.latitude, lng: asset.longitude });
    mapRef.current.setZoom(16);
    const marker = markersRef.current.find(
      (m) => m.getTitle()?.startsWith(asset.assetNumber),
    );
    if (marker && infoRef.current) {
      infoRef.current.setContent(
        `<div style="font:14px/1.4 system-ui,sans-serif;max-width:220px">
          <strong>${asset.assetNumber}</strong><br/>
          ${asset.name}<br/>
          <a href="/assets/${asset.id}" style="color:#004825;font-weight:600">Open asset</a>
         </div>`,
      );
      infoRef.current.open({ map: mapRef.current, anchor: marker });
    }
  };

  if (mapsError === "missing-key") {
    return (
      <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 text-sm text-[color:var(--ventia-muted)]">
        <p className="font-medium text-[color:var(--ventia-ink)]">Map not configured</p>
        <p className="mt-2">
          Add a Google Maps API key under{" "}
          <a href="/manage/system" className="font-semibold text-[color:var(--ventia-blue)] underline">
            Admin → System
          </a>
          , or set <code className="font-mono text-xs">GOOGLE_MAPS_API_KEY</code> in{" "}
          <code className="font-mono text-xs">/etc/veninspect.env</code>. Enable the{" "}
          <strong>Maps JavaScript API</strong> and restrict the key by HTTP referrer to include{" "}
          <code className="font-mono text-xs">http://192.168.13.10:8181/*</code> (and localhost if
          needed). Billing must be enabled on the Google Cloud project.
        </p>
        <p className="mt-3">
          Assets with coordinates: <strong>{withCoords.length}</strong> / {assets.length}
        </p>
      </div>
    );
  }

  if (mapsError === "load-failed") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
        <p className="font-medium">Google Maps failed to load</p>
        <p className="mt-2">
          Usually the API key referrer allow-list does not include this site. In Google Cloud →
          Credentials, add{" "}
          <code className="font-mono text-xs">http://192.168.13.10:8181/*</code> (and enable Maps
          JavaScript API + billing). Then hard-refresh this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          {withCoords.length} mapped · {assets.length - withCoords.length} without coords
        </span>
      </div>

      {locError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {locError}
        </p>
      ) : null}

      <div
        ref={mapEl}
        className="h-[min(55vh,420px)] w-full overflow-hidden rounded-2xl border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)]"
        role="region"
        aria-label="Asset map"
      />

      {userPos ? (
        <section className="space-y-2">
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
                      selectedId === asset.id ? "bg-[color:var(--ventia-green-tint)]" : ""
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
