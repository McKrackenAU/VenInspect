"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AssetvisionConfigForm({
  baseUrl,
  apiKey,
}: {
  baseUrl: string;
  apiKey: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(baseUrl);
  const [key, setKey] = useState(apiKey);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const res = await fetch("/api/manage/assetvision", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetvisionBaseUrl: url,
              assetvisionApiKey: key,
            }),
          });
          if (!res.ok) {
            setMsg("Save failed");
            return;
          }
          setMsg("Saved");
          router.refresh();
        });
      }}
    >
      <label className="block text-sm">
        Base URL
        <input
          className="field-input mt-1 w-full"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://assetvision.example/api"
        />
      </label>
      <label className="block text-sm">
        API key
        <input
          className="field-input mt-1 w-full font-mono text-sm"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          type="password"
        />
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        disabled={pending || !url}
        className="ml-2 rounded-lg border px-3 py-2 text-sm"
        onClick={() => {
          startTransition(async () => {
            const res = await fetch("/api/manage/assetvision/sync", {
              method: "POST",
            });
            const body = (await res.json().catch(() => null)) as {
              error?: string;
              message?: string;
            } | null;
            setMsg(body?.message || body?.error || (res.ok ? "OK" : "Failed"));
          });
        }}
      >
        Test / pull assets
      </button>
      {msg ? <p className="text-xs text-[color:var(--ventia-muted)]">{msg}</p> : null}
    </form>
  );
}
