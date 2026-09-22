export function AcademyCard({ hasAcademyAccess }: { hasAcademyAccess: boolean }) {
  return (
    <section id="academy" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="cb-eyebrow">Academy · {hasAcademyAccess ? "Lifetime actief" : "Eenmalig"}</div>
          <h2 className="mt-3 cb-section-title">
            {hasAcademyAccess ? "Je Academy-toegang blijft actief" : "Volledige trading Academy"}
          </h2>
          <p className="mt-3 cb-body">
            Alle modules levenslang toegankelijk, drie gratis 1-op-1 calls en drie maanden gratis marktupdates en Weekly Outlooks.
          </p>
          <p className="mt-5 text-lg font-extrabold text-[var(--foreground)]">
            €2.000 <span className="text-sm font-semibold text-[var(--muted)]">eenmalig · incl. btw</span>
          </p>
        </div>
        {!hasAcademyAccess ? (
          <form action="/api/billing/academy-checkout" method="post" className="shrink-0">
            <button type="submit" className="cb-btn cb-btn-primary w-full justify-center sm:w-auto">
              Academy kopen
            </button>
          </form>
        ) : null}
      </div>
      <p className="mt-6 border-t border-[var(--border)] pt-5 cb-caption">
        De subscriptionbonus stopt automatisch na drie maanden. Er start nooit stilzwijgend een betalend abonnement.
      </p>
    </section>
  );
}
