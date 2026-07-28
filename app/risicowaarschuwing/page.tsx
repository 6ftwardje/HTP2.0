import Link from "next/link";
import { BrandLogo } from "@/components/ui/Brand";

export default function RiskWarningPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-10 text-[var(--foreground)] sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <BrandLogo logoClassName="h-auto w-[220px]" />

        <article className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-9">
          <p className="cb-eyebrow">Risicowaarschuwing</p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
            Virtuele munten, reële risico&apos;s.
          </h1>
          <p className="mt-3 text-lg font-bold">
            De enige garantie in crypto is het risico.
          </p>

          <p className="mt-7 cb-body">
            Het Trade Platform is uitsluitend een educatieve leeromgeving.
            Inhoud, lessen, voorbeelden, coaching en AI-output zijn algemene
            informatie en geen financieel, beleggings-, fiscaal of juridisch
            advies, geen persoonlijke aanbeveling en geen garantie op resultaat.
            Wij voeren geen transacties voor je uit. Je beslist en handelt
            volledig op eigen verantwoordelijkheid en kunt je volledige inleg
            verliezen.
          </p>

          <h2 className="mt-9 cb-section-title">Belangrijkste risico&apos;s</h2>
          <ul className="mt-5 list-disc space-y-3 pl-6 cb-body">
            <li>
              De waarde van uw virtuele munten kan sterk op en neer gaan, en het
              door u belegde bedrag kan integraal verloren gaan.
            </li>
            <li>
              Virtuele munten zijn niet gedekt door garantieregelingen voor
              bankdeposito&apos;s.
            </li>
            <li>
              Op de markt van de virtuele munten is geen enkel wettelijk
              mechanisme beschikbaar waarmee marktmanipulatie of misbruik van
              voorkennis kan worden vermeden.
            </li>
            <li>
              Virtuele munten zijn volledig afhankelijk van een specifieke
              computertechnologie en -infrastructuur, die in bepaalde gevallen
              zeer recent ontwikkeld en nog onvoldoende getest kan zijn.
            </li>
            <li>
              Bij verlies van de identificatiecode die of het wachtwoord dat
              toegang verleent tot de virtuele portefeuille waarin de virtuele
              munten zijn opgeslagen, zullen die munten definitief verloren zijn.
            </li>
            <li>
              Virtuele munten worden thans beperkt als betaalmiddel aanvaard, en
              in de meeste landen bestaat er geen enkele wettelijke verplichting
              om ze te aanvaarden.
            </li>
          </ul>

          <div className="mt-9 flex flex-wrap gap-4 border-t border-[var(--border)] pt-6">
            <a
              href="https://www.wikifin.be/nl/sparen-en-beleggen/beleggingsproducten/andere-beleggingsproducten/cryptomunten/wat-een-cryptomunt"
              target="_blank"
              rel="noreferrer"
              className="cb-btn cb-btn-secondary"
            >
              Meer informatie bij Wikifin
            </a>
            <Link href="/" className="cb-btn cb-btn-primary">
              Terug naar inloggen
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
