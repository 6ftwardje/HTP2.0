import Link from "next/link";
import type { BillingOverview } from "@/lib/billing";

export function SubscriptionPaywall({
  overview,
  title = "Deze content is onderdeel van de subscription",
}: {
  overview: BillingOverview;
  title?: string;
}) {
  const paymentFailed = overview.subscription?.status === "past_due";
  const expiredBonus = Boolean(overview.expiredBonus);
  const manage = paymentFailed && Boolean(overview.subscription);

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-7 text-center shadow-[var(--shadow-soft)] sm:p-10">
      <div className="cb-eyebrow">
        {paymentFailed
          ? "Betaling vereist"
          : expiredBonus
            ? "Je gratis bonus is verlopen"
            : "Subscription vereist"}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-[var(--foreground)] sm:text-3xl">
        {paymentFailed ? "Herstel je betaling om verder te kijken" : title}
      </h1>
      <p className="mx-auto mt-4 max-w-xl cb-body">
        Marktupdates en Weekly Outlook-livesessies zijn beschikbaar voor €99 per maand inclusief btw. Opzeggen kan tegen het einde van iedere betaalperiode.
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <form action={manage ? "/api/billing/portal" : "/api/billing/checkout"} method="post">
          <button type="submit" className="cb-btn cb-btn-primary">
            {manage ? "Betaling herstellen" : "Subscription starten"}
          </button>
        </form>
        <Link href="/account" className="cb-btn cb-btn-secondary">
          Bekijk op profiel
        </Link>
      </div>
    </section>
  );
}
