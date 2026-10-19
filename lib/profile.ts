import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { getSafeAuthNext } from "@/lib/auth-redirect";

export function normalizeProfileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  return name.length > 0 && name.length <= 100 && /\p{L}/u.test(name) &&
    !/[\p{Cc}\p{Cf}]/u.test(name) && !["onbekend", "unknown"].includes(name.toLocaleLowerCase("nl-BE")) ? name : null;
}

export function normalizeProfilePhone(value: unknown, country = "BE"): string | null {
  if (typeof value !== "string" || value.length > 80 || !/^[+\d\s().-]+$/.test(value)) return null;
  const input = value.trim().replace(/^00/, "+");
  if (!input.startsWith("+") && !["BE", "NL"].includes(country)) return null;
  const phone = parsePhoneNumberFromString(input, {defaultCountry: country as CountryCode, extract:false});
  return phone?.isValid() && !phone.ext ? phone.number : null;
}

export function profileIsComplete(profile: {name?: string | null; phone?: string | null}) {
  return Boolean(normalizeProfileName(profile.name) && normalizeProfilePhone(profile.phone));
}

export function profileReturnTo(value: string | null) {
  const safe = getSafeAuthNext(value);
  const pathname = safe.split(/[?#]/, 1)[0];
  // Avoid profile/auth/recovery loops and navigating a page to an API endpoint.
  return /^\/(?:auth|api|profile-completion|login|update-password|reset-password)(?:\/|$)/.test(pathname) || pathname === "/account/update-password" || pathname === "/" ? "/dashboard" : safe;
}

export function profileCompletionUrl(next: string | null) {
  return "/profile-completion?next=" + encodeURIComponent(profileReturnTo(next));
}

export function greetingFirstName(name: string | null) {
  const first = normalizeProfileName(name)?.split(" ")[0];
  if (!first) return null;
  const [initial, ...rest] = Array.from(first);
  return initial.toLocaleUpperCase("nl-BE") + rest.join("");
}
