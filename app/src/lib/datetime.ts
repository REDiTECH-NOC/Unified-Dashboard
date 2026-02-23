/**
 * Timezone-aware date/time formatting utilities.
 *
 * All functions accept flexible input (Date | string | number | null | undefined)
 * and convert from UTC to the specified IANA timezone using Intl.DateTimeFormat.
 *
 * Rule: Store everything in UTC. Convert to user timezone only at display time.
 */

export const DEFAULT_TIMEZONE = "America/Chicago";

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** Full date+time: "Feb 23, 2026, 2:30 PM" */
export function formatDateTime(
  input: DateInput,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Date only: "Feb 23, 2026" */
export function formatDate(
  input: DateInput,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Time only: "2:30 PM" */
export function formatTime(
  input: DateInput,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Compact time for dense UI: "02:30 PM" */
export function formatTimeShort(
  input: DateInput,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Short date for chart axes: "Feb 23" */
export function formatDateShort(
  input: DateInput,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Relative time: "5 min ago", "2 hours ago". Falls back to full date after 30 days. */
export function formatRelative(
  input: DateInput,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(input);
  if (!d) return "—";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  return formatDateTime(d, timezone);
}

/** US-focused timezone options for the profile selector. */
export const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "UTC", label: "UTC" },
] as const;
