"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DEFAULT_EMAIL_FROM,
  DEFAULT_EMAIL_FROM_NAME,
  DEFAULT_PUBLIC_BASE_URL,
} from "@/lib/mail-constants";

export function EmailConfigForm({
  initial,
}: {
  initial: {
    enabled: boolean;
    from: string;
    fromName: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    hasSmtpPassword: boolean;
    publicBaseUrl: string;
    statusReason: string;
    statusReady: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(initial.enabled);
  const [from, setFrom] = useState(initial.from || DEFAULT_EMAIL_FROM);
  const [fromName, setFromName] = useState(
    initial.fromName || DEFAULT_EMAIL_FROM_NAME,
  );
  const [host, setHost] = useState(initial.smtpHost);
  const [port, setPort] = useState(String(initial.smtpPort || 465));
  const [secure, setSecure] = useState(initial.smtpSecure);
  const [user, setUser] = useState(initial.smtpUser);
  const [password, setPassword] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState(
    initial.publicBaseUrl || DEFAULT_PUBLIC_BASE_URL,
  );

  function save(thenTest: boolean) {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/manage/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          emailEnabled: enabled,
          emailFrom: from,
          emailFromName: fromName,
          emailSmtpHost: host,
          emailSmtpPort: Number(port) || 465,
          emailSmtpSecure: secure,
          emailSmtpUser: user,
          emailSmtpPassword: password,
          keepExistingPassword: !password && initial.hasSmtpPassword,
          publicBaseUrl,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        status?: { ready?: boolean; reason?: string };
      } | null;
      if (!res.ok) {
        setError(body?.error || "Save failed");
        return;
      }
      setPassword("");
      setMsg(body?.status?.reason || "Saved.");
      router.refresh();

      if (thenTest) {
        const test = await fetch("/api/manage/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({}),
        });
        const testBody = (await test.json().catch(() => null)) as {
          error?: string;
          to?: string;
        } | null;
        if (!test.ok) {
          setError(testBody?.error || "Test send failed");
          return;
        }
        setMsg(`Test email sent to ${testBody?.to ?? "your account"}.`);
      }
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)]/40 px-3 py-2 text-sm text-[color:var(--ventia-muted)]">
        Cloudflare hosts DNS for <strong>inspect-it.online</strong>; it does not
        provide outbound SMTP. Use a lightweight provider such as{" "}
        <strong>Resend</strong> (free tier): create an API key, verify the
        domain in Resend (DNS records in Cloudflare), then set SMTP host{" "}
        <code className="font-mono text-xs">smtp.resend.com</code>, user{" "}
        <code className="font-mono text-xs">resend</code>, password = API key.
        From address: <code className="font-mono text-xs">{DEFAULT_EMAIL_FROM}</code>.
      </div>

      <p
        className={`text-sm ${initial.statusReady ? "text-[color:var(--ventia-green)]" : "text-amber-800"}`}
      >
        Status: {initial.statusReason}
      </p>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-[color:var(--ventia-green)]"
        />
        Enable outbound email
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          Public site URL (for links in emails)
          <input
            className="field-input mt-1 w-full"
            value={publicBaseUrl}
            onChange={(e) => setPublicBaseUrl(e.target.value)}
            placeholder={DEFAULT_PUBLIC_BASE_URL}
          />
        </label>
        <label className="block text-sm">
          From address
          <input
            className="field-input mt-1 w-full font-mono text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder={DEFAULT_EMAIL_FROM}
          />
        </label>
        <label className="block text-sm">
          From name
          <input
            className="field-input mt-1 w-full"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder={DEFAULT_EMAIL_FROM_NAME}
          />
        </label>
        <label className="block text-sm">
          SMTP host
          <input
            className="field-input mt-1 w-full font-mono text-sm"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.resend.com"
          />
        </label>
        <label className="block text-sm">
          SMTP port
          <input
            className="field-input mt-1 w-full font-mono text-sm"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="465"
          />
        </label>
        <label className="block text-sm">
          SMTP username
          <input
            className="field-input mt-1 w-full font-mono text-sm"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="resend"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          SMTP password / API key
          <input
            type="password"
            className="field-input mt-1 w-full font-mono text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              initial.hasSmtpPassword ? "•••••••• (unchanged if blank)" : "API key"
            }
            autoComplete="new-password"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={secure}
          onChange={(e) => setSecure(e.target.checked)}
          className="accent-[color:var(--ventia-green)]"
        />
        Use TLS (secure) — on for port 465
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="btn-primary"
          onClick={() => save(false)}
        >
          {pending ? "Saving…" : "Save email settings"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-[color:var(--ventia-border)] px-4 py-2 text-sm font-semibold"
          onClick={() => save(true)}
        >
          Save & send test to me
        </button>
      </div>

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-[color:var(--ventia-muted)]" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
