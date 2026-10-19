import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/ui/Brand";
import { ProfileCompletionForm } from "@/components/profile/ProfileCompletionForm";
import { getStudentForProfileCompletion } from "@/lib/students";
import { normalizeProfileName, profileIsComplete, profileReturnTo } from "@/lib/profile";

export default async function ProfileCompletionPage({searchParams}: {searchParams:Promise<{next?:string}>}) {
  const {student,error}=await getStudentForProfileCompletion();
  if(error||!student)redirect("/login?redirectedFrom="+encodeURIComponent("/profile-completion"));
  const next=profileReturnTo((await searchParams).next??null);
  if(profileIsComplete(student))redirect(next);
  return <main className="platform-surface flex min-h-screen items-center justify-center px-4 py-12"><section className="cb-panel w-full max-w-lg p-6 sm:p-9" aria-labelledby="profile-title">
    <BrandLogo/>
    <h1 id="profile-title" className="cb-h1 mt-7">Maak je profiel compleet</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Vul je naam en telefoonnummer aan om verder te gaan. Dit hoef je maar één keer te doen.</p>
    <ProfileCompletionForm name={normalizeProfileName(student.name)??""} phone={student.phone??""} next={next}/>
    <form action="/auth/signout" method="post"><button type="submit" className="mt-6 inline-flex min-h-11 items-center text-sm text-[var(--muted)] underline underline-offset-4">Uitloggen</button></form>
  </section></main>;
}
