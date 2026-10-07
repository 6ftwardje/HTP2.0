"use client";
import Link from "next/link";
export default function MarketPostError({ reset }: { reset: () => void }) {
  return <section className="market-post"><Link href="/market-analysis" className="market-post-back">Alle marktinzichten</Link><h1 className="mt-8 text-2xl font-bold">Dit marktinzicht kon niet worden geladen</h1><p className="mt-3 text-[var(--muted)]">Probeer opnieuw. Je kunt ook terug naar het overzicht.</p><button type="button" onClick={reset} className="cb-btn cb-btn-primary mt-6">Opnieuw proberen</button></section>;
}
