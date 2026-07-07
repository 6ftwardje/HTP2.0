# Supabase Auth Email Templates

Styled templates for Het Trade Platform authentication emails. Paste each HTML file into the matching Supabase dashboard template under Authentication > Email Templates.

## Subjects

| Supabase template | Subject |
| --- | --- |
| Confirm sign up | `Bevestig je e-mailadres | Het Trade Platform` |
| Invite user | `Je bent uitgenodigd voor Het Trade Platform` |
| Magic link or OTP | `Je inloglink voor Het Trade Platform` |
| Change email address | `Bevestig je nieuwe e-mailadres` |
| Reset password | `Stel je wachtwoord opnieuw in` |

## Files

| Supabase template | File |
| --- | --- |
| Confirm sign up | `confirm-sign-up.html` |
| Invite user | `invite-user.html` |
| Magic link or OTP | `magic-link-or-otp.html` |
| Change email address | `change-email-address.html` |
| Reset password | `reset-password.html` |

## Notes

- Templates use inline CSS and table layout for email-client compatibility.
- CTA links point to `/auth/confirm` with `{{ .TokenHash }}`. The app verifies the token with Supabase and sets the session cookie before redirecting to the right page.
- The Magic link or OTP template also shows `{{ .Token }}` for future OTP support.
- Keep auth emails transactional: no marketing copy, no tracking pixels, no large images.
