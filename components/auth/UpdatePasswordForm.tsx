"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FormStatus = "idle" | "loading" | "success" | "error";

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setStatus("error");
      setMessage("Gebruik een wachtwoord van minimaal 8 tekens.");
      return;
    }

    if (password !== passwordConfirmation) {
      setStatus("error");
      setMessage("De wachtwoorden komen niet overeen.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage("Je wachtwoord kon niet worden gewijzigd. Vraag een nieuwe resetlink aan.");
      return;
    }

    setStatus("success");
    setMessage("Je wachtwoord is gewijzigd. Je kunt terug naar de academy.");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-stone-200">
          Nieuw wachtwoord
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
          autoComplete="new-password"
          className="w-full rounded-xl border border-stone-700 bg-white/5 px-4 py-3 text-stone-50 placeholder:text-stone-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500/70 disabled:opacity-60"
        />
      </div>
      <div>
        <label htmlFor="password-confirmation" className="mb-1.5 block text-sm font-semibold text-stone-200">
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
          className="w-full rounded-xl border border-stone-700 bg-white/5 px-4 py-3 text-stone-50 placeholder:text-stone-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500/70 disabled:opacity-60"
        />
      </div>

      {message && (
        <p
          role="alert"
          className={`text-sm leading-6 ${status === "error" ? "text-red-300" : "text-emerald-300"}`}
        >
          {message}
        </p>
      )}

      {status === "success" ? (
        <a href="/dashboard" className="cb-btn cb-btn-primary w-full">
          Naar de academy
        </a>
      ) : (
        <button
          type="submit"
          disabled={status === "loading"}
          className="cb-btn cb-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Even geduld..." : "Wachtwoord opslaan"}
        </button>
      )}
    </form>
  );
}
