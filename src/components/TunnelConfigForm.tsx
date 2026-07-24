"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function TunnelConfigForm({
  token,
  hostname,
}: {
  token: string;
  hostname: string;
}) {
  const router = useRouter();
  const [t, setT] = useState(token);
  const [h, setH] = useState(hostname);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const res = await fetch("/api/manage/tunnel", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cloudflareTunnelToken: t,
              cloudflareTunnelHostname: h,
            }),
          });
          const body = (await res.json().catch(() => null)) as {
            error?: string;
            installHint?: string;
          } | null;
          if (!res.ok) {
            setMsg(body?.error || "Save failed");
            return;
          }
          setMsg(body?.installHint || "Saved");
          router.refresh();
        });
      }}
    >
      <label className="block text-sm">
        Tunnel token
        <textarea
          className="field-input mt-1 min-h-[5rem] w-full font-mono text-xs"
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder="eyJ…"
        />
      </label>
      <label className="block text-sm">
        Public hostname (optional display)
        <input
          className="field-input mt-1 w-full"
          value={h}
          onChange={(e) => setH(e.target.value)}
          placeholder="veninspect.example.com"
        />
      </label>
      {h ? (
        <p className="text-sm">
          Public URL:{" "}
          <a
            className="font-semibold text-[color:var(--ventia-blue)]"
            href={`https://${h}`}
            target="_blank"
            rel="noreferrer"
          >
            https://{h}
          </a>
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save tunnel config"}
      </button>
      {msg ? <p className="text-xs text-[color:var(--ventia-muted)]">{msg}</p> : null}
    </form>
  );
}
