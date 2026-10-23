export type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

const EMAIL_OTP_TYPES = new Set<string>([
  "signup", "invite", "magiclink", "recovery", "email_change", "email",
]);

export function getEmailOtpType(value: unknown): EmailOtpType | null {
  return typeof value === "string" && EMAIL_OTP_TYPES.has(value) ? value as EmailOtpType : null;
}

export function getConfirmationNext(type: EmailOtpType, next: string) {
  if (type === "recovery") return "/account/update-password";
  if (type === "invite") return "/account/update-password?mode=invite";
  return next;
}

export const AUTH_LINK_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
