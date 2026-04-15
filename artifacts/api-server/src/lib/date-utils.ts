/**
 * Date utilities shared across invoice PDF generation and email sending.
 */

/**
 * Returns the next business day (Monday–Friday) from a given date.
 * Skips Saturdays and Sundays.
 *
 * Used for payment deadline language:
 * "Wire must be received by close of business the following business day ({{date}})"
 */
export function nextBusinessDayFrom(from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
