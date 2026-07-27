import { format as formatDateFns } from "date-fns";
import { readStorageSettings } from "@/lib/paths";

export type DateTimePrefs = {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
};

export function getDateTimePrefs(): DateTimePrefs {
  const s = readStorageSettings();
  return {
    timezone: s.timezone?.trim() || "Australia/Melbourne",
    dateFormat: s.dateFormat?.trim() || "dd MMM yyyy",
    timeFormat: s.timeFormat?.trim() || "HH:mm",
  };
}

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Lightweight formatter using prefs (Intl + date-fns patterns we care about). */
export function formatAppDate(
  date: Date | string | number,
  style: "date" | "time" | "datetime" | "dayMonth" | "isoDate" = "date",
) {
  const d = typeof date === "object" && date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const prefs = getDateTimePrefs();
  try {
    const z = zonedParts(d, prefs.timezone);
    const local = new Date(z.year, z.month - 1, z.day, z.hour, z.minute);
    if (style === "date") return formatDateFns(local, prefs.dateFormat);
    if (style === "time") return formatDateFns(local, prefs.timeFormat);
    if (style === "dayMonth") return formatDateFns(local, "dd MMM");
    if (style === "isoDate") {
      return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
    }
    return formatDateFns(local, `${prefs.dateFormat} ${prefs.timeFormat}`);
  } catch {
    if (style === "isoDate") return formatDateFns(d, "yyyy-MM-dd");
    if (style === "dayMonth") return formatDateFns(d, "dd MMM");
    return formatDateFns(d, style === "time" ? "HH:mm" : "dd MMM yyyy");
  }
}

/** Fixed pattern in app timezone (PDF / folder-style stamps). */
export function formatAppPattern(
  date: Date | string | number,
  pattern: string,
) {
  const d = typeof date === "object" && date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const prefs = getDateTimePrefs();
  try {
    const z = zonedParts(d, prefs.timezone);
    const local = new Date(
      z.year,
      z.month - 1,
      z.day,
      z.hour,
      z.minute,
      0,
    );
    return formatDateFns(local, pattern);
  } catch {
    return formatDateFns(d, pattern);
  }
}

export function greetingForNow(firstName: string | null | undefined, fullName: string) {
  const prefs = getDateTimePrefs();
  let hour = new Date().getHours();
  try {
    hour = zonedParts(new Date(), prefs.timezone).hour;
  } catch {
    /* keep */
  }
  const part =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = (firstName?.trim() || fullName.split(/\s+/)[0] || fullName).trim();
  return `${part}, ${name}`;
}

export function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function fullNameFromParts(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
