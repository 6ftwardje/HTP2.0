import type { BillingOverview } from "@/lib/billing";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Brussels",
  }).format(new Date(value));
}

function SubscriptionAction({ manage }: { manage: boolean }) {
  return (
    <form action={manage ? "/api/billing/portal" : "/api/billing/checkout"} method="post">
      <button type="submit" className="cb-btn cb-btn-primary w-full justify-center sm:w-auto">
        {manage ? "Abonnement beheren" : "Abonnement kopen"}
      </button>
    </form>
  );
}

export function SubscriptionCard({ overview }: { overview: BillingOverview }) {
  const { subscription, entitlement, expiredBonus, hasAccess, accessSource } =
    overview;
  const periodEnd = formatDate(subscription?.current_period_end ?? null);
  const entitlementEnd = formatDate(entitlement?.ends_at ?? null);
  const bonusExpiredAt = formatDate(expiredBonus?.ends_at ?? null);
  const needsPayment = subscription?.status === "past_due";
  const manage = Boolean(subscription && !["canceled", "incomplete_expired"].includes(subscription.status));

  let eyebrow = "Niet actief";
  let title = "Ontgrendel marktupdates en livesessies";
  let description =
    "Krijg minstens twee marktupdates en één Weekly Outlook-livesessie per week.";

  if (needsPayment) {
    eyebrow = "Betaling vereist";
    title = "Je betaling kon niet worden verwerkt";
    description =
      "Je subscriptioncontent is onmiddellijk vergrendeld. Werk je betaalmethode bij om opnieuw toegang te krijgen.";
  } else if (hasAccess && accessSource === "subscription") {
    eyebrow = subscription?.cancel_at_period_end ? "Opgezegd" : "Actief";
    title = subscription?.cancel_at_period_end
      ? `Toegang tot ${periodEnd ?? "het einde van je betaalperiode"}`
      : "Je abonnement is actief";
    description = subscription?.cancel_at_period_end
      ? "Er volgen geen nieuwe kosten. Je kunt de opzegging vóór de einddatum nog intrekken."
      : `Je volgende betaalperiode start ${periodEnd ? `op ${periodEnd}` : "automatisch"}.`;
  } else if (hasAccess) {
    eyebrow = accessSource === "legacy_bonus" ? "Welkomstbonus" : "Academybonus";
    title = `Gratis toegang tot ${entitlementEnd ?? "de bonus eindigt"}`;
    description =
      "Deze bonus wordt niet automatisch betalend. Na de einddatum kies je zelf of je verdergaat voor €99 per maand.";
  } else if (expiredBonus) {
    eyebrow = "Bonus verlopen";
    title = "Je gratis subscriptiontoegang is verlopen";
    description = `Je bonus eindigde${bonusExpiredAt ? ` op ${bonusExpiredAt}` : ""}. De video-updates en livesessies zijn nu vergrendeld.`;
  }

  return (
    <section id="subscription" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="cb-eyebrow">Subscription · {eyebrow}</div>
          <h2 className="mt-3 cb-section-title">{title}</h2>
          <p className="mt-3 cb-body">{description}</p>
          <p className="mt-5 text-lg font-extrabold text-[var(--foreground)]">
            €99 <span className="text-sm font-semibold text-[var(--muted)]">/ maand · incl. btw</span>
          </p>
        </div>

        <div className="shrink-0">
          <SubscriptionAction manage={manage} />
        </div>
      </div>

      <ul className="mt-7 grid gap-3 border-t border-[var(--border)] pt-6 text-sm text-[var(--foreground)] sm:grid-cols-3">
        <li>Minstens 2 marktupdates per week</li>
        <li>1 Weekly Outlook-livesessie per week</li>
        <li>Replays minstens 4 weken beschikbaar</li>
      </ul>
    </section>
  );
}
