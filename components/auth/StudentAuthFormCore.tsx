"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BrandLogo } from "@/components/ui/Brand";
import { getSafeAuthNext } from "@/lib/auth-redirect";

type AuthMode = "login" | "register" | "reset" | "confirm";
type FormStatus = "idle" | "loading" | "success" | "error";
type AuthFailure = {
  status?: number;
};
type SupabaseClientFactory = () => Promise<SupabaseClient>;

const LEGAL_ACCEPTANCE_VERSION = "2026-07-28-fsma-mica-v1";
const LEGAL_ACCEPTANCE_SCOPE =
  "terms_privacy_education_no_advice_crypto_risk_disclaimer";

function getEmailAuthErrorMessage(error: AuthFailure, fallback: string) {
  if (error.status === 429) {
    return "Er zijn te veel e-mails aangevraagd. Wacht even en probeer het later opnieuw.";
  }

  return fallback;
}

function getSiteOrigin() {
  if (["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return window.location.origin;
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredSiteUrl) return window.location.origin;

  try {
    const url = new URL(
      configuredSiteUrl.startsWith("http")
        ? configuredSiteUrl
        : `https://${configuredSiteUrl}`
    );

    return url.origin;
  } catch {
    return window.location.origin;
  }
}

function AuthForm({ getSupabaseClient }: { getSupabaseClient: SupabaseClientFactory }) {
  const searchParams = useSearchParams();
  const redirectedFrom = getSafeAuthNext(searchParams.get("redirectedFrom") ?? searchParams.get("next"));
  const callbackFailed = searchParams.get("error") === "auth";
  const initialMode: AuthMode =
    searchParams.get("mode") === "reset" ? "reset" : searchParams.get("mode") === "confirm" ? "confirm" : searchParams.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [confirmationRequested, setConfirmationRequested] = useState(false);
  const submitting = useRef(false);
  const needsPassword = mode === "login" || mode === "register";
  const waitingForConfirmation = confirmationRequested && (mode === "register" || mode === "confirm");
  const formLocked = status === "loading" || status === "success" || waitingForConfirmation;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const type = hash.get("type") ?? searchParams.get("type");
    if (hash.has("error") || hash.has("error_code") || hash.has("error_description")) {
      const params = new URLSearchParams({ reason: "invalid_link" });
      if (type) params.set("flow", type);
      window.location.replace(`/auth/error?${params}`);
      return;
    }
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (cancelled) return;
        if (error) {
          window.location.replace("/auth/error?reason=invalid_link");
          return;
        }
        window.location.replace(type === "recovery" ? "/account/update-password" : type === "invite" ? "/account/update-password?mode=invite" : redirectedFrom);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Deze beveiligde link kon niet worden geopend. Vraag een nieuwe link aan.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [getSupabaseClient, redirectedFrom, searchParams]);


  function selectMode(nextMode: AuthMode) {
    if (submitting.current) return;
    setMode(nextMode);
    setConfirmationRequested(false);
    setStatus("idle");
    setMessage("");
    setPassword("");
    setPasswordConfirmation("");
    setAcceptedLegalTerms(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || submitting.current || waitingForConfirmation || (mode === "confirm" && resendSeconds > 0)) return;

    if (mode === "register" && !fullName.trim()) {
      setStatus("error");
      setMessage("Vul je voor- en achternaam in.");
      return;
    }

    if (mode === "register" && password.length < 8) {
      setStatus("error");
      setMessage("Gebruik een wachtwoord van minimaal 8 tekens.");
      return;
    }

    if (mode === "register" && password !== passwordConfirmation) {
      setStatus("error");
      setMessage("De wachtwoorden komen niet overeen.");
      return;
    }

    if (needsPassword && !acceptedLegalTerms) {
      setStatus("error");
      setMessage(
        "Lees en aanvaard eerst de voorwaarden en risicowaarschuwing."
      );
      return;
    }

    submitting.current = true;
    setStatus("loading");
    setMessage("");

    try {
      const supabase = await getSupabaseClient();

      if (mode === "login") {
        const acceptedAt = new Date().toISOString();
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          console.error("[auth.login_failed]", {
            status: error.status,
            code: error.code,
          });
          setStatus("error");
          setMessage(error.code === "email_not_confirmed"
            ? "Bevestig eerst je e-mailadres. Je kunt hieronder een nieuwe bevestigingsmail aanvragen."
            : "Inloggen lukt niet. Controleer je e-mailadres en wachtwoord.");
          return;
        }

        const { error: acceptanceError } = await supabase.auth.updateUser({
          data: {
            legal_acceptance_version: LEGAL_ACCEPTANCE_VERSION,
            legal_acceptance_accepted_at: acceptedAt,
            legal_acceptance_scope: LEGAL_ACCEPTANCE_SCOPE,
            legal_acceptance_source: "login",
          },
        });

        if (acceptanceError) {
          console.error("[auth.legal_acceptance_save_failed]", {
            status: acceptanceError.status,
            code: acceptanceError.code,
          });
          await supabase.auth.signOut();
          setStatus("error");
          setMessage(
            "Je akkoord kon niet veilig worden geregistreerd. Probeer opnieuw."
          );
          return;
        }

        window.location.assign(redirectedFrom);
        return;
      }

      if (mode === "register") {
        const acceptedAt = new Date().toISOString();
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              legal_acceptance_version: LEGAL_ACCEPTANCE_VERSION,
              legal_acceptance_accepted_at: acceptedAt,
              legal_acceptance_scope: LEGAL_ACCEPTANCE_SCOPE,
              legal_acceptance_source: "registration",
            },
            emailRedirectTo: getSiteOrigin(),
          },
        });

        if (error) {
          console.error("[auth.registration_failed]", {
            status: error.status,
            code: error.code,
          });
          setStatus("error");
          setMessage(
            getEmailAuthErrorMessage(
              error,
              "Registreren lukt momenteel niet. Probeer het later opnieuw."
            )
          );
          return;
        }

        if (data.session) {
            window.location.assign(redirectedFrom);
          return;
        }

        setStatus("success");
        setConfirmationRequested(true);
        setResendSeconds(60);
        setMessage(
          "Controleer je mailbox en je spammap. Open de bevestigingsmail en klik daarna op ‘Account bevestigen’. Heb je al een account? Log dan in met je bestaande wachtwoord."
        );
        return;
      }

      if (mode === "confirm") {
        const { error } = await supabase.auth.resend({
          type: "signup", email: trimmedEmail, options: { emailRedirectTo: getSiteOrigin() },
        });
        if (error) {
          setStatus("error");
          if (error.status === 429) setResendSeconds(60);
          setMessage(getEmailAuthErrorMessage(error, "De bevestigingsmail kon niet worden verstuurd. Probeer het later opnieuw."));
          return;
        }
        setStatus("success");
        setConfirmationRequested(true);
        setResendSeconds(60);
        setMessage("Als dit e-mailadres nog bevestigd moet worden, ontvang je een nieuwe bevestigingsmail. Gebruik de nieuwste mail. Is je account al bevestigd? Dan kun je direct inloggen.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${getSiteOrigin()}/auth/callback?type=recovery&next=/account/update-password`,
      });

      if (error) {
        console.error("[auth.password_reset_failed]", {
          status: error.status,
          code: error.code,
        });
        setStatus("error");
        setMessage(
          getEmailAuthErrorMessage(
            error,
            "De resetmail kon niet worden verstuurd. Probeer het later opnieuw."
          )
        );
        return;
      }

      setStatus("success");
      setResendSeconds(60);
      setMessage(
        "Als dit e-mailadres bij ons bekend is, ontvang je zo een link om je wachtwoord te wijzigen."
      );
    } catch {
      setStatus("error");
      setMessage("De verbinding werd onderbroken. Controleer je internetverbinding en probeer opnieuw.");
    } finally {
      submitting.current = false;
    }
  }

  async function resendConfirmation() {
    if (submitting.current || resendSeconds > 0) return;
    submitting.current = true;
    setStatus("loading");
    setMessage("");
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: getSiteOrigin() },
      });
      setResendSeconds(60);
      setStatus(error ? "error" : "success");
      setMessage(error
        ? getEmailAuthErrorMessage(error, "De bevestigingsmail kon niet worden verstuurd. Probeer het later opnieuw.")
        : "Als je e-mailadres nog bevestigd moet worden, ontvang je een nieuwe mail. Gebruik alleen de nieuwste bevestigingsmail.");
    } catch {
      setStatus("error");
      setMessage("De verbinding werd onderbroken. Probeer het opnieuw.");
    } finally {
      submitting.current = false;
    }
  }

  const displayMessage =
    message ||
    (callbackFailed
      ? "De bevestigingslink is ongeldig of verlopen. Probeer het opnieuw."
      : "");
  const displayStatus = message ? status : callbackFailed ? "error" : status;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,var(--card)_12%)] px-12 py-14 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,color-mix(in_oklab,var(--muted)_28%,transparent),transparent_38%),radial-gradient(circle_at_90%_85%,color-mix(in_oklab,var(--foreground)_12%,transparent),transparent_42%)]" />
          <div className="relative">
            <BrandLogo tone="on-dark" logoClassName="h-auto w-[250px]" />
          </div>
          <div className="relative max-w-lg">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Het Trade Platform
            </p>
            <h1 className="text-5xl font-extrabold uppercase leading-[0.98] tracking-[-0.04em] text-[var(--foreground)]">
              Groei verder als trader.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[color-mix(in_oklab,var(--foreground)_82%,var(--muted))]">
              Log in op je persoonlijke leeromgeving en ga verder waar je gebleven bent.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <BrandLogo
              className="mb-10 lg:hidden"
              logoClassName="h-auto w-[220px]"
            />

            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Persoonlijke leeromgeving
            </p>
            <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[var(--foreground)]">
              {mode === "login"
                ? "Welkom terug"
                : mode === "register"
                  ? "Maak je account aan"
                  : mode === "confirm" ? "Bevestig je e-mailadres" : "Nieuw wachtwoord aanvragen"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {mode === "login"
                ? "Gebruik het e-mailadres en wachtwoord waarmee je je hebt geregistreerd."
                : mode === "register"
                  ? "Registreer je eenmalig om toegang te krijgen tot de academy."
                  : mode === "confirm" ? "Vraag een nieuwe bevestigingsmail aan. Een nieuw account aanmaken is niet nodig." : "We sturen je een beveiligde link om een nieuw wachtwoord te kiezen."}
            </p>

            {needsPassword && (
              <div className="mt-8 grid grid-cols-2 border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => selectMode("login")}
                  className={`border-b-2 px-2 py-3 text-sm font-bold transition-colors ${
                    mode === "login"
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Inloggen
                </button>
                <button
                  type="button"
                  onClick={() => selectMode("register")}
                  className={`border-b-2 px-2 py-3 text-sm font-bold transition-colors ${
                    mode === "register"
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Registreren
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {mode === "register" && (
                <div>
                  <label htmlFor="full-name" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                    Naam
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Voor- en achternaam"
                    required
                    disabled={formLocked}
                    autoComplete="name"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--foreground)_35%,transparent)] disabled:opacity-60"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                  E-mailadres
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="jij@voorbeeld.be"
                  required
                  disabled={formLocked}
                  autoComplete="email"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--foreground)_35%,transparent)] disabled:opacity-60"
                />
              </div>

              {needsPassword && (
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                    Wachtwoord
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "login" ? "Je wachtwoord" : "Minimaal 8 tekens"}
                    required
                    minLength={mode === "register" ? 8 : undefined}
                    disabled={formLocked}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--foreground)_35%,transparent)] disabled:opacity-60"
                  />
                </div>
              )}

              {mode === "register" && (
                <div>
                  <label htmlFor="password-confirmation" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                    Herhaal wachtwoord
                  </label>
                  <input
                    id="password-confirmation"
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    placeholder="Herhaal je wachtwoord"
                    required
                    minLength={8}
                    disabled={formLocked}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--foreground)_35%,transparent)] disabled:opacity-60"
                  />
                </div>
              )}

              {needsPassword && (
                <div className="flex items-start gap-3 py-1 text-sm leading-6">
                  <label className="flex shrink-0 items-start">
                    <input
                      type="checkbox"
                      checked={acceptedLegalTerms}
                      onChange={(event) => setAcceptedLegalTerms(event.target.checked)}
                      required
                      aria-label="Ik aanvaard de risicowaarschuwing"
                      aria-describedby="legal-risk-link"
                      disabled={formLocked}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--foreground)] disabled:opacity-60"
                    />
                  </label>
                  <a
                    id="legal-risk-link"
                    href="/risicowaarschuwing"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--muted)]"
                  >
                    Lees de volledige risicowaarschuwing
                  </a>
                </div>
              )}

              {displayMessage && (
                <p
                  role="alert"
                  className={`text-sm leading-6 ${
                    displayStatus === "error" ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {displayMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={formLocked || (mode === "confirm" && resendSeconds > 0)}
                className="cb-btn cb-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "loading" ? "Even geduld..." : waitingForConfirmation ? "Bevestigingsmail aangevraagd" : status === "success" && mode === "reset" ? "Resetmail aangevraagd" : mode === "login" ? "Inloggen" : mode === "register" ? "Account aanmaken" : mode === "confirm" ? "Stuur bevestigingsmail" : "Stuur resetlink"}
              </button>
            </form>

            {waitingForConfirmation && (
              <button type="button" disabled={resendSeconds > 0 || status === "loading"} onClick={resendConfirmation} className="mt-5 block min-h-11 text-sm font-semibold text-[var(--muted)] disabled:opacity-60">
                {resendSeconds > 0 ? `Opnieuw versturen over ${resendSeconds} s` : "Bevestigingsmail opnieuw versturen"}
              </button>
            )}
            {mode !== "reset" && (
              <button type="button" disabled={status === "loading"} onClick={() => selectMode(mode === "confirm" || waitingForConfirmation ? "login" : "confirm")} className="mt-5 block min-h-11 text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">
                {mode === "confirm" || waitingForConfirmation ? "Terug naar inloggen" : "Geen bevestigingsmail ontvangen?"}
              </button>
            )}

            <button
              type="button"
              onClick={() => selectMode(mode === "reset" ? "login" : "reset")}
              className="mt-5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              {mode === "reset" ? "Terug naar inloggen" : "Wachtwoord vergeten?"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthFallback() {
  return <div className="min-h-screen bg-[var(--background)]" />;
}

export function StudentAuthFormCore({
  getSupabaseClient,
}: {
  getSupabaseClient: SupabaseClientFactory;
}) {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthForm getSupabaseClient={getSupabaseClient} />
    </Suspense>
  );
}
