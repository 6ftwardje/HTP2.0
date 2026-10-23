import Link from "next/link";
import { BrandLogo } from "@/components/ui/Brand";
import { getEmailOtpType } from "@/lib/auth-confirmation";
import { getSafeAuthNext } from "@/lib/auth-redirect";

type Props = {
  searchParams: Promise<{ reason?: string; flow?: string; next?: string }>;
};

const ERROR_COPY = {
  invalid_link: {
    title: "Deze beveiligde link is ongeldig of verlopen",
    description:
      "Bevestigings- en resetlinks kunnen maar beperkt geldig zijn en kunnen doorgaans slechts één keer worden gebruikt.",
  },
  recovery_session_missing: {
    title: "Je resetsessie ontbreekt of is verlopen",
    description:
      "Open de meest recente resetmail opnieuw. Werkt die link niet meer, vraag dan een nieuwe resetlink aan.",
  },
  configuration: {
    title: "De aanmeldservice is tijdelijk niet beschikbaar",
    description:
      "De beveiligde verbinding met de aanmeldservice kon niet worden gestart. Probeer het later opnieuw.",
  },
  service_unavailable: {
    title: "Bevestigen lukt tijdelijk niet",
    description: "De aanmeldservice kon niet worden bereikt. Probeer de link uit je e-mail over enkele minuten opnieuw.",
  },
  rate_limited: {
    title: "Wacht even voor je opnieuw probeert",
    description: "Er zijn te veel pogingen gedaan. Open de link uit je e-mail over enkele minuten opnieuw.",
  },
} as const;

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason, flow, next } = await searchParams;
  const type = getEmailOtpType(flow);
  const signup = type === "signup" || type === "email";
  const recovery = type === "recovery" || reason === "recovery_session_missing";
  const defaultCopy =
    ERROR_COPY[reason as keyof typeof ERROR_COPY] ?? ERROR_COPY.invalid_link;
  const copy = reason === "invalid_link" && type === "invite" ? {
    title: "Deze uitnodiging werkt niet meer",
    description: "Heb je al een wachtwoord gekozen? Probeer dan in te loggen. Vraag anders de beheerder om een nieuwe uitnodiging.",
  } : reason === "invalid_link" && type === "email_change" ? {
    title: "Deze bevestiging werkt niet meer",
    description: "Controleer in je account of je e-mailadres al gewijzigd is. Is dat niet zo, vraag de wijziging daar opnieuw aan.",
  } : reason === "invalid_link" && signup ? {
    title: "Deze bevestigingslink werkt niet meer",
    description: "Je e-mailadres is mogelijk al bevestigd. Probeer eerst in te loggen met je gekozen wachtwoord. Lukt dat nog niet, vraag dan een nieuwe bevestigingsmail aan.",
  } : defaultCopy;
  const params = new URLSearchParams({ next: getSafeAuthNext(next ?? null) });
  const loginHref = `/login?${params}`;
  const confirmationHref = `/login?${new URLSearchParams({ ...Object.fromEntries(params), mode: "confirm" })}`;
  const secondaryHref = recovery ? loginHref : type === "invite" ? "mailto:info@hettradeplatform.be" : type === "email_change" ? "/account" : signup || !type ? confirmationHref : "/login?mode=reset";
  const secondaryLabel = recovery ? "Terug naar inloggen" : type === "invite" ? "Nieuwe uitnodiging aanvragen" : type === "email_change" ? "E-mailadres controleren" : signup || !type ? "Nieuwe bevestigingsmail aanvragen" : "Wachtwoord vergeten?";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10 text-[var(--foreground)]">
      <section className="w-full max-w-md">
        <BrandLogo className="mb-10" logoClassName="h-auto w-[220px]" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <h1 className="text-3xl font-extrabold tracking-[-0.035em]">
            {copy.title}
          </h1>
          <p className="mt-4 cb-body">{copy.description}</p>
          <div className="mt-7 flex flex-col gap-3">
            <Link href={recovery ? "/login?mode=reset" : loginHref} className="cb-btn cb-btn-primary">
              {recovery ? "Nieuwe resetlink aanvragen" : "Inloggen"}
            </Link>
            <Link href={secondaryHref} className="cb-btn cb-btn-secondary">
              {secondaryLabel}
            </Link>
            {!type && !recovery && <Link href="/login?mode=reset" className="cb-btn cb-btn-secondary">Wachtwoord vergeten?</Link>}
          </div>
        </div>
      </section>
    </main>
  );
}
