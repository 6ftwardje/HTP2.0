import Link from "next/link";

export default function NotFound() {
  return <main className="platform-surface flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
    <section className="w-full max-w-xl" aria-labelledby="not-found-title">
      <h1 id="not-found-title" className="cb-page-title">Deze pagina bestaat niet</h1>
      <p className="mt-4 text-[var(--muted)]">Controleer de link of ga naar je dashboard om verder te gaan.</p>
      <Link href="/dashboard" className="cb-btn cb-btn-primary mt-8">Naar dashboard</Link>
    </section>
  </main>;
}
