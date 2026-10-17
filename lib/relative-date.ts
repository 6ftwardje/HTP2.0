export const PLATFORM_TIMEZONE = "Europe/Brussels";

const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLATFORM_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const exact = new Intl.DateTimeFormat("nl-BE", {
  timeZone: PLATFORM_TIMEZONE, day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const relative = new Intl.RelativeTimeFormat("nl-BE", { numeric: "always" });

function calendarDay(value: Date) {
  const parts = Object.fromEntries(calendar.formatToParts(value).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000;
}

export function relativeDate(value: string, now = Date.now()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now)) {
    return { label: "Datum onbekend", exact: "Datum onbekend", dateTime: undefined };
  }
  const seconds = (date.getTime() - now) / 1000;
  const days = calendarDay(date) - calendarDay(new Date(now));
  let label: string;
  if (days === -1) label = "gisteren";
  else if (days === 1) label = "morgen";
  else if (days !== 0) {
    const magnitude = Math.abs(days);
    const [amount, unit] = magnitude < 7 ? [days, "day"] : magnitude < 30 ? [Math.round(days / 7), "week"]
      : magnitude < 365 ? [Math.round(days / 30), "month"] : [Math.round(days / 365), "year"];
    label = relative.format(amount as number, unit as Intl.RelativeTimeFormatUnit);
  } else if (Math.abs(seconds) < 60) label = "zojuist";
  else if (Math.abs(seconds) < 3600) label = relative.format(Math.trunc(seconds / 60), "minute");
  else label = relative.format(Math.trunc(seconds / 3600), "hour");
  return { label, exact: `${exact.format(date)} (Brussel)`, dateTime: date.toISOString() };
}
