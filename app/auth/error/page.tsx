import Link from "next/link";
import { BrandLogo } from "@/components/ui/Brand";

type Props = {
  searchParams: Promise<{ reason?: string }>;
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
} as const;

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const copy =
    ERROR_COPY[reason as keyof typeof ERROR_COPY] ?? ERROR_COPY.invalid_link;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10 text-[var(--foreground)]">
      <section className="w-full max-w-md">
        <BrandLogo className="mb-10" logoClassName="h-auto w-[220px]" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <p className="cb-eyebrow">Accountbeveiliging</p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.035em]">
            {copy.title}
          </h1>
          <p className="mt-4 cb-body">{copy.description}</p>
          <div className="mt-7 flex flex-col gap-3">
            <Link href="/?mode=reset" className="cb-btn cb-btn-primary">
              Nieuwe resetlink aanvragen
            </Link>
            <Link href="/" className="cb-btn cb-btn-secondary">
              Terug naar inloggen
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
