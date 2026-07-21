import { saveGoogleMapsApiKey } from "@/lib/actions";

export function MapsApiKeyForm({
  source,
  configured,
  maskedKey,
}: {
  source: "env" | "settings" | "none";
  configured: boolean;
  maskedKey: string | null;
}) {
  const lockedByEnv = source === "env";

  return (
    <form action={saveGoogleMapsApiKey} className="space-y-3">
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Required for the asset map and nearby-asset lookup. Prefer restricting the key by HTTP
        referrer in Google Cloud (Maps JavaScript API).
      </p>
      {configured ? (
        <p className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm">
          Key configured via <strong>{source}</strong>
          {maskedKey ? (
            <>
              : <code className="font-mono text-xs">{maskedKey}</code>
            </>
          ) : null}
        </p>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          No Maps API key set yet — map page will show a setup message.
        </p>
      )}
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-[color:var(--ventia-muted)]">Google Maps API key</span>
        <input
          name="googleMapsApiKey"
          type="password"
          autoComplete="off"
          disabled={lockedByEnv}
          placeholder={lockedByEnv ? "Managed in /etc/veninspect.env" : "Paste API key"}
          className="field-input w-full font-mono text-sm disabled:opacity-60"
        />
      </label>
      <p className="text-xs text-[color:var(--ventia-muted)]">
        Stored in <code className="font-mono">settings.json</code> under the data directory when
        not set in the environment. Leave blank and save to clear a settings-based key.
      </p>
      <button
        type="submit"
        disabled={lockedByEnv}
        className="rounded-xl bg-[color:var(--ventia-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Save Maps key
      </button>
    </form>
  );
}
