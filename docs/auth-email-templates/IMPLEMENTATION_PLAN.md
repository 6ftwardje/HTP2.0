# Auth Email Reliability Plan

## Goal

Make authentication email delivery reliable, secure, measurable, and easy to recover when something breaks.

## Phase 1 - Configuration Baseline

1. Set Supabase Site URL and Redirect URLs per environment.
   - Temporary production: `https://htp2.netlify.app`
   - Callback allowlist: `https://htp2.netlify.app/auth/callback**`
   - Local allowlist: `http://localhost:3000/auth/callback**`
2. Set Netlify `NEXT_PUBLIC_SITE_URL` to the same canonical environment URL.
3. Enable custom SMTP with a dedicated sender mailbox:
   - Sender: `noreply@hettradeplatform.be`
   - Sender name: `Het Trade Platform`
   - Host: `smtp-auth.mailprotect.be`
   - Port: `465` with SSL, fallback `587` with TLS
4. Keep `info@hettradeplatform.be` as the human support address, not the auth sender.

## Phase 2 - Domain Authentication

1. Confirm there is exactly one SPF TXT record for `hettradeplatform.be`.
   - For Combell Basic mail: `v=spf1 include:_spf.relay.mailprotect.be -all`
2. Add DMARC in monitoring mode first:
   - Host: `_dmarc`
   - Value: `v=DMARC1; p=none`
3. Verify DKIM availability for the actual Combell mailbox/product.
   - If DKIM is not available on the mailbox type, move auth email to a transactional provider or Combell mailserver product that supports DKIM.
4. After stable delivery, move DMARC gradually:
   - `p=none`
   - `p=quarantine`
   - `p=reject`

## Phase 3 - Template Rollout

1. Paste each HTML template into the matching Supabase template.
2. Use the subjects from `README.md`.
3. Send test emails for:
   - New signup confirmation
   - Password reset
   - Admin invite
   - Email address change
   - Magic link, only if enabled
4. Test in Gmail, Outlook, Apple Mail, and mobile mail.

## Phase 4 - Platform Hardening

1. Add server-side audit logging for auth-sensitive actions where the app controls the flow:
   - Password reset requested
   - Password updated
   - Email change requested
   - Email change completed
   - Admin invite sent
2. Add rate limiting and abuse controls around forms that trigger email:
   - Per email address
   - Per IP
   - Per user session
3. Add CAPTCHA or Turnstile on public signup/reset flows if abuse starts or before a public launch.
4. Keep generic user-facing error messages to avoid account enumeration.
5. Add success states that do not reveal whether an email exists.

## Phase 5 - Monitoring And Recovery

1. Create a weekly deliverability check:
   - Send auth emails to Gmail, Outlook, iCloud test inboxes
   - Confirm inbox placement and link behavior
2. Monitor Supabase Auth logs after every SMTP/template change.
3. Use mail-tester or equivalent after DNS changes.
4. Keep a backup SMTP provider ready for outages or deliverability drops.
5. Document a rollback procedure:
   - Restore previous SMTP settings
   - Restore previous template HTML
   - Re-run signup and reset tests

## Recommended Production Upgrade

Combell SMTP is acceptable for low-volume auth email. For production-grade delivery, use a transactional provider such as Postmark, Resend, SES, Brevo, or SendGrid with verified DKIM, SPF, DMARC, bounce handling, and provider-level delivery logs.
