import { redirect } from "next/navigation";
import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/ui/Brand";

export default async function UpdatePasswordPage({ searchParams }: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const invite = (await searchParams).mode === "invite";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/error?reason=recovery_session_missing");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-5 py-10 text-stone-50">
      <section className="w-full max-w-md">
        <BrandLogo
          className="mb-10"
          logoClassName="h-auto w-[220px]"
        />
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
          {invite ? "Account activeren" : "Account herstellen"}
        </p>
        <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-white">
          {invite ? "Kies je wachtwoord" : "Kies een nieuw wachtwoord"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          {invite ? "Kies een wachtwoord van minimaal 8 tekens om je uitgenodigde account te gebruiken." : "Kies een nieuw wachtwoord van minimaal 8 tekens; daarna kun je direct verder in het platform."}
        </p>
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
