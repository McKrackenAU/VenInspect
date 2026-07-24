"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DateTimePrefsForm({
  timezone,
  dateFormat,
  timeFormat,
}: {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}) {
  const router = useRouter();
  const [tz, setTz] = useState(timezone);
  const [df, setDf] = useState(dateFormat);
  const [tf, setTf] = useState(timeFormat);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const res = await fetch("/api/manage/system-prefs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timezone: tz,
              dateFormat: df,
              timeFormat: tf,
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
        Timezone (IANA)
        <input
          className="field-input mt-1 w-full"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          placeholder="Australia/Melbourne"
        />
      </label>
      <label className="block text-sm">
        Date format (date-fns)
        <input
          className="field-input mt-1 w-full font-mono text-sm"
          value={df}
          onChange={(e) => setDf(e.target.value)}
          placeholder="dd MMM yyyy"
        />
      </label>
      <label className="block text-sm">
        Time format (date-fns)
        <input
          className="field-input mt-1 w-full font-mono text-sm"
          value={tf}
          onChange={(e) => setTf(e.target.value)}
          placeholder="HH:mm"
        />
      </label>
      <button type="submit" disabled={pending} className="btn-primary text-sm">
        {pending ? "Saving…" : "Save date & time"}
      </button>
      {msg ? <p className="text-xs text-[color:var(--ventia-green)]">{msg}</p> : null}
    </form>
  );
}
