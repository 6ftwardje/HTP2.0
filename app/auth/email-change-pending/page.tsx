import Link from "next/link";
import { BrandLogo } from "@/components/ui/Brand";

export default function EmailChangePendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10 text-[var(--foreground)]">
      <section className="w-full max-w-md">
        <BrandLogo className="mb-10" logoClassName="h-auto w-[220px]" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <h1 className="text-3xl font-extrabold tracking-[-0.035em]">Bevestiging ontvangen</h1>
          <p className="mt-4 cb-body">Controleer ook je andere mailbox. De wijziging van je e-mailadres is pas voltooid als je de bevestigingslinks op je oude en nieuwe adres hebt gebruikt.</p>
          <Link href="/account" className="cb-btn cb-btn-primary mt-7 w-full">Naar je account</Link>
        </div>
      </section>
    </main>
  );
}
