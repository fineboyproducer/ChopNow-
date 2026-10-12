const NIGERIA_LOCALE = "en-NG";
const NIGERIA_TIMEZONE = "Africa/Lagos";

/** Formats a date/ISO string as "2:45 PM" in Nigeria's timezone. */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(NIGERIA_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: NIGERIA_TIMEZONE,
  });
}

/** Formats a date/ISO string as "21 Jul 2026". */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(NIGERIA_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: NIGERIA_TIMEZONE,
  });
}

/** Formats a date/ISO string as "21 Jul 2026, 2:45 PM". */
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/**
 * Formats the time elapsed since `date` as a short relative string:
 * "just now", "5m ago", "2h ago", "3d ago". Falls back to a plain date
 * beyond 7 days, since "12d ago" is less useful than the actual date.
 */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(d);
}

/** Formats a duration given in seconds as "4m 12s" or "1h 5m". */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
