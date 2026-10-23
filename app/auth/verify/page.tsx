import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/ui/Brand";
import { ConfirmEmailButton } from "@/components/auth/ConfirmEmailButton";
import { getEmailOtpType } from "@/lib/auth-confirmation";
import { getSafeAuthNext } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "E-maillink bevestigen | Het Trade Platform", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const params = await searchParams;
  const type = getEmailOtpType(params.type);
  if (!type || typeof params.token_hash !== "string" || !params.token_hash) redirect("/auth/error?reason=invalid_link");
  const recovery = type === "recovery";
  const invite = type === "invite";
  const emailChange = type === "email_change";
  const title = recovery ? "Stel je wachtwoord opnieuw in" : invite ? "Accepteer je uitnodiging" : emailChange ? "Bevestig je e-mailadres" : type === "magiclink" ? "Log veilig in" : "Bevestig je account";
  const action = recovery ? "Verder naar nieuw wachtwoord" : invite ? "Uitnodiging accepteren" : emailChange ? "E-mailadres bevestigen" : type === "magiclink" ? "Inloggen" : "Account bevestigen";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10 text-[var(--foreground)]">
      <section className="w-full max-w-md">
        <BrandLogo className="mb-10" logoClassName="h-auto w-[220px]" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <h1 className="text-3xl font-extrabold tracking-[-0.035em]">{title}</h1>
          <p className="mt-4 cb-body">
            {recovery ? "Klik hieronder om een nieuw wachtwoord te kiezen." : invite ? "Klik hieronder en kies daarna een wachtwoord voor je account." : emailChange ? "Klik hieronder om de wijziging van je e-mailadres te bevestigen." : "Klik hieronder om veilig verder te gaan naar Het Trade Platform."}
          </p>
          <p className="mt-3 cb-body">Bevestig hier dat je zelf verder wilt gaan.</p>
          <form action="/auth/confirm" method="post" className="mt-7">
            <input type="hidden" name="token_hash" value={params.token_hash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={getSafeAuthNext(params.next ?? null)} />
            <ConfirmEmailButton label={action} />
          </form>
          <Link href="/login" className="cb-btn cb-btn-secondary mt-3 w-full">Terug naar inloggen</Link>
        </div>
      </section>
    </main>
  );
}
