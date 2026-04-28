export interface OrgLocale {
  timezone:   string;
  date_format: string;
}

const DEFAULT_LOCALE: OrgLocale = {
  timezone:   "America/New_York",
  date_format: "MM/DD/YYYY",
};

function applyDateFormat(fmt: string, month: string, day: string, year: string): string {
  if (fmt === "DD/MM/YYYY") return `${day}/${month}/${year}`;
  if (fmt === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return `${month}/${day}/${year}`;
}

export function formatOrgDate(
  iso: string | null | undefined,
  locale?: OrgLocale | null,
  includeTime = false,
): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "—";
    const tz  = locale?.timezone   || DEFAULT_LOCALE.timezone;
    const fmt = locale?.date_format || DEFAULT_LOCALE.date_format;

    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day:   "2-digit",
    }).formatToParts(date);

    const month = dateParts.find((p) => p.type === "month")?.value ?? "01";
    const day   = dateParts.find((p) => p.type === "day")?.value   ?? "01";
    const year  = dateParts.find((p) => p.type === "year")?.value  ?? "2000";

    const dateStr = applyDateFormat(fmt, month, day, year);
    if (!includeTime) return dateStr;

    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   true,
    }).formatToParts(date);

    const hour      = timeParts.find((p) => p.type === "hour")?.value      ?? "12";
    const minute    = timeParts.find((p) => p.type === "minute")?.value    ?? "00";
    const dayPeriod = timeParts.find((p) => p.type === "dayPeriod")?.value?.toLowerCase() ?? "am";

    return `${dateStr} ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return "—";
  }
}

export function formatOrgRelative(
  iso: string | null | undefined,
  locale?: OrgLocale | null,
): string {
  if (!iso) return "Never";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30)  return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return formatOrgDate(iso, locale);
  } catch {
    return "—";
  }
}
