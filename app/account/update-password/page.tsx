import { redirect } from "next/navigation";
import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/ui/Brand";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?error=auth");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-5 py-10 text-stone-50">
      <section className="w-full max-w-md">
        <BrandLogo
          className="mb-10"
          iconClassName="h-12 w-12"
          textClassName="text-base"
        />
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Account herstellen
        </p>
        <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-white">
          Kies een nieuw wachtwoord
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          Gebruik minimaal 8 tekens. Daarna kun je direct verder in het platform.
        </p>
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
