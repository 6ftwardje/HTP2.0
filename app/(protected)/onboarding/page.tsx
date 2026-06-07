import { PageHeader } from "@/components/layout/PageHeader";
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
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Intake" }]}
        eyebrow={isEditing ? "Profielcontext" : "Verplichte intake"}
        title={isEditing ? "Werk je intake bij" : "Maak je traject persoonlijker"}
        description={
          isEditing
            ? "Je antwoorden blijven later aanpasbaar. We gebruiken deze context om begeleiding relevanter te maken."
            : "Vul deze korte intake in voordat je de videocourse opent. Zo kunnen mentors en toekomstige AI-coaching beter begrijpen waar je nu staat."
        }
      />
      <OnboardingWizard
        response={response}
        hasError={params?.error === "incomplete"}
      />
    </div>
  );
}
