"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BrandLogo } from "@/components/ui/Brand";

type AuthMode = "login" | "register" | "reset";
type FormStatus = "idle" | "loading" | "success" | "error";
type AuthFailure = {
  status?: number;
};
type SupabaseClientFactory = () => Promise<SupabaseClient>;

function getEmailAuthErrorMessage(error: AuthFailure, fallback: string) {
  if (error.status === 429) {
    return "Er zijn te veel e-mails aangevraagd. Wacht even en probeer het later opnieuw.";
  }

  return fallback;
}

function getSafeRedirect(redirectedFrom: string | null) {
  if (
    !redirectedFrom?.startsWith("/") ||
    redirectedFrom.startsWith("//") ||
    redirectedFrom.includes("\\")
  ) {
    return "/dashboard";
  }

  return redirectedFrom;
}

function getCallbackUrl(next: string) {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", getSafeRedirect(next));
  return callbackUrl.toString();
}

function AuthForm({ getSupabaseClient }: { getSupabaseClient: SupabaseClientFactory }) {
  const searchParams = useSearchParams();
  const redirectedFrom = getSafeRedirect(searchParams.get("redirectedFrom"));
  const callbackFailed = searchParams.get("error") === "auth";

  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStatus("idle");
    setMessage("");
    setPassword("");
    setPasswordConfirmation("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) return;

    if (mode !== "reset" && password.length < 8) {
      setStatus("error");
      setMessage("Gebruik een wachtwoord van minimaal 8 tekens.");
      return;
    }

    if (mode === "register" && password !== passwordConfirmation) {
      setStatus("error");
      setMessage("De wachtwoorden komen niet overeen.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const supabase = await getSupabaseClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setStatus("error");
        setMessage("Inloggen lukt niet. Controleer je e-mailadres en wachtwoord.");
        return;
      }

      window.location.assign(redirectedFrom);
      return;
    }

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: getCallbackUrl(redirectedFrom),
        },
      });

      if (error) {
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
      setMessage(
        "Je account is aangemaakt. Controleer je mailbox en bevestig je e-mailadres."
      );
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: getCallbackUrl("/account/update-password"),
    });

    if (error) {
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
    setMessage(
      "Als dit e-mailadres bij ons bekend is, ontvang je zo een link om je wachtwoord te wijzigen."
    );
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
            <BrandLogo logoClassName="h-auto w-[250px]" />
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
                  : "Nieuw wachtwoord aanvragen"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {mode === "login"
                ? "Gebruik het e-mailadres en wachtwoord waarmee je je hebt geregistreerd."
                : mode === "register"
                  ? "Registreer je eenmalig om toegang te krijgen tot de academy."
                  : "We sturen je een beveiligde link om een nieuw wachtwoord te kiezen."}
            </p>

            {mode !== "reset" && (
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
                    disabled={status === "loading" || status === "success"}
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
                  disabled={status === "loading" || status === "success"}
                  autoComplete="email"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--foreground)_35%,transparent)] disabled:opacity-60"
                />
              </div>

              {mode !== "reset" && (
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
                    Wachtwoord
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimaal 8 tekens"
                    required
                    minLength={8}
                    disabled={status === "loading" || status === "success"}
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
                    disabled={status === "loading" || status === "success"}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--foreground)_35%,transparent)] disabled:opacity-60"
                  />
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
                disabled={status === "loading" || status === "success"}
                className="cb-btn cb-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "loading"
                  ? "Even geduld..."
                  : mode === "login"
                    ? "Inloggen"
                    : mode === "register"
                      ? "Account aanmaken"
                      : "Stuur resetlink"}
              </button>
            </form>

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
