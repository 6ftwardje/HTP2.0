import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ensureCurrentStudent } from "@/lib/students";
import { getStudentOnboardingResponse } from "@/lib/onboarding";

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
  const { student } = await ensureCurrentStudent();
  const response = student
    ? await getStudentOnboardingResponse(student.id)
    : null;
  const params = searchParams ? await searchParams : {};
  const isEditing = !!response?.completed_at;

  return (
    <section className="grid h-auto min-h-0 gap-8 overflow-visible lg:h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1fr)] lg:overflow-hidden xl:gap-12">
      <aside className="flex min-h-0 flex-col justify-center overflow-hidden">
        <div className="cb-eyebrow">
          Dashboard / {isEditing ? "Profielcontext" : "Verplichte intake"}
        </div>
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.02] text-[var(--foreground)] sm:text-5xl xl:text-[3.4rem]">
          {isEditing ? "Werk je intake bij" : "Maak je traject persoonlijker"}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
          {isEditing
            ? "Je antwoorden blijven later aanpasbaar. We gebruiken deze context om begeleiding relevanter te maken."
            : "Vul deze korte intake in voordat je de videocourse opent. Zo kunnen mentors en toekomstige AI-coaching beter begrijpen waar je nu staat."}
        </p>
        <div className="mt-8 grid max-w-xl gap-4 border-t border-[var(--border)] pt-6 sm:grid-cols-2">
          <div>
            <p className="cb-caption">Waarom</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              Betere begeleiding
            </p>
          </div>
          <div>
            <p className="cb-caption">Status</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {isEditing ? "Ingevuld" : "Nodig voor videocourse"}
            </p>
          </div>
        </div>
      </aside>

      <div className="min-h-0 overflow-hidden">
        <OnboardingWizard
          response={response}
          error={
            params?.error === "save_failed" || params?.error === "incomplete"
              ? params.error
              : undefined
          }
        />
      </div>
    </section>
  );
}
