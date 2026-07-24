"use client";

import { useId, useState } from "react";
import { saveGoogleMapsApiKey } from "@/lib/actions";
import type { MapProvider } from "@/lib/paths";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Password-style key field with a reveal/hide eye on the right. */
function SecretKeyField({
  name,
  label,
  defaultValue,
  disabled,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  disabled?: boolean;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-[color:var(--ventia-muted)]">{label}</span>
      <div
        className={`flex min-h-[var(--touch)] items-stretch overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--field-bg)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[color:var(--ventia-green-mid)] ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 font-mono text-sm text-[color:var(--ventia-ink)] outline-none placeholder:text-[color:var(--ventia-muted)]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled && !defaultValue}
          className="flex w-12 shrink-0 items-center justify-center border-l border-[color:var(--ventia-border)] text-[color:var(--ventia-muted)] hover:bg-[color:var(--ventia-green-tint)] hover:text-[color:var(--ventia-ink)] disabled:pointer-events-none disabled:opacity-40"
          aria-label={visible ? "Hide API key" : "Show API key"}
          aria-controls={id}
          aria-pressed={visible}
          title={visible ? "Hide key" : "Show key"}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </label>
  );
}

export function MapsApiKeyForm({
  source,
  mapProvider,
  googleApiKey,
  nearmapApiKey,
  nearmapLocked = false,
}: {
  source: "env" | "settings" | "none";
  mapProvider: MapProvider;
  googleApiKey: string;
  nearmapApiKey: string;
  nearmapLocked?: boolean;
}) {
  const googleLocked = source === "env";
  const googleConfigured = Boolean(googleApiKey);
  const nearmapConfigured = Boolean(nearmapApiKey);

  return (
    <form action={saveGoogleMapsApiKey} className="space-y-4">
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Choose the basemap for Asset map. Tiles load in the browser — VenInspect does not
        proxy imagery, so server load stays low.
      </p>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-[color:var(--ventia-muted)]">Map provider</span>
        <select
          name="mapProvider"
          defaultValue={mapProvider}
          className="field-input w-full"
        >
          <option value="osm">OpenStreetMap (free, no key)</option>
          <option value="google">Google Maps (needs JS API key + billing)</option>
          <option value="nearmap">Nearmap aerial (needs Tile API key)</option>
        </select>
      </label>

      <div className="space-y-2">
        {googleConfigured ? (
          <p className="text-xs text-[color:var(--ventia-muted)]">
            Google key via <strong>{source}</strong>
            {googleLocked ? " (edit in /etc/veninspect.env)" : ""}. Use the eye to reveal.
          </p>
        ) : (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            No Google key yet — required only if provider is Google Maps.
          </p>
        )}
        <SecretKeyField
          name="googleMapsApiKey"
          label="Google Maps API key"
          defaultValue={googleApiKey}
          disabled={googleLocked}
          placeholder={
            googleLocked ? "Managed in /etc/veninspect.env" : "Paste API key"
          }
        />
        <p className="text-[10px] text-[color:var(--ventia-muted)]">
          Enable Maps JavaScript API, billing, and HTTP referrer{" "}
          <code className="font-mono">http://192.168.13.10:8181/*</code>. Clear the field
          and save to remove a settings-based key.
        </p>
      </div>

      <div className="space-y-2">
        {nearmapConfigured ? (
          <p className="text-xs text-[color:var(--ventia-muted)]">
            Nearmap key configured
            {nearmapLocked ? " via environment" : ""}. Use the eye to reveal.
          </p>
        ) : (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            No Nearmap key yet — required only if provider is Nearmap.
          </p>
        )}
        <SecretKeyField
          name="nearmapApiKey"
          label="Nearmap API key"
          defaultValue={nearmapApiKey}
          disabled={nearmapLocked}
          placeholder={
            nearmapLocked ? "Managed in /etc/veninspect.env" : "Paste API key"
          }
        />
        <p className="text-[10px] text-[color:var(--ventia-muted)]">
          Nearmap Tile API loads in the phone/browser (
          <code className="font-mono">api.nearmap.com</code>
          ). Clear the field and save to remove a settings-based key.
        </p>
      </div>

      <button
        type="submit"
        className="rounded-xl bg-[color:var(--ventia-green)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Save map settings
      </button>
    </form>
  );
}
