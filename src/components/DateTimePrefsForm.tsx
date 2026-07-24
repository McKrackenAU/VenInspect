"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const TIMEZONES = [
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEST/AEDT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane (AEST)" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide" },
  { value: "Australia/Perth", label: "Australia/Perth (AWST)" },
  { value: "Australia/Hobart", label: "Australia/Hobart" },
  { value: "Australia/Darwin", label: "Australia/Darwin" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland" },
  { value: "UTC", label: "UTC" },
] as const;

const DATE_FORMATS = [
  { value: "dd MMM yyyy", label: "24 Jul 2026", example: "dd MMM yyyy" },
  { value: "dd/MM/yyyy", label: "24/07/2026", example: "dd/MM/yyyy" },
  { value: "dd-MM-yyyy", label: "24-07-2026", example: "dd-MM-yyyy" },
  { value: "yyyy-MM-dd", label: "2026-07-24", example: "yyyy-MM-dd" },
  { value: "d MMMM yyyy", label: "24 July 2026", example: "d MMMM yyyy" },
] as const;

const TIME_FORMATS = [
  { value: "HH:mm", label: "14:30 (24-hour)", example: "HH:mm" },
  { value: "HH:mm:ss", label: "14:30:00 (24-hour + seconds)", example: "HH:mm:ss" },
  { value: "h:mm a", label: "2:30 pm (12-hour)", example: "h:mm a" },
] as const;

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
  const tzOptions = useMemo(() => {
    const known = TIMEZONES.map((t) => t.value);
    if (timezone && !known.includes(timezone as (typeof TIMEZONES)[number]["value"])) {
      return [{ value: timezone, label: `${timezone} (custom)` }, ...TIMEZONES];
    }
    return [...TIMEZONES];
  }, [timezone]);

  const [tz, setTz] = useState(timezone || "Australia/Melbourne");
  const [df, setDf] = useState(dateFormat || "dd MMM yyyy");
  const [tf, setTf] = useState(timeFormat || "HH:mm");
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
        Timezone
        <select
          className="field-input mt-1 w-full"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        >
          {tzOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Date format
        <select
          className="field-input mt-1 w-full"
          value={
            DATE_FORMATS.some((d) => d.value === df) ? df : DATE_FORMATS[0].value
          }
          onChange={(e) => setDf(e.target.value)}
        >
          {DATE_FORMATS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label} — {d.example}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Time format
        <select
          className="field-input mt-1 w-full"
          value={
            TIME_FORMATS.some((t) => t.value === tf) ? tf : TIME_FORMATS[0].value
          }
          onChange={(e) => setTf(e.target.value)}
        >
          {TIME_FORMATS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn-primary text-sm">
        {pending ? "Saving…" : "Save date & time"}
      </button>
      {msg ? <p className="text-xs text-[color:var(--ventia-green)]">{msg}</p> : null}
    </form>
  );
}
