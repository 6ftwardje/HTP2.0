import Link from "next/link";
import { redirect } from "next/navigation";
import { MentorChatPanel } from "@/components/mentor/MentorChatPanel";
import { getChatAccess, getChatMentors, getOrCreateStudentMentorConversation } from "@/lib/mentor-chat";
import { ChatPeople } from "@/components/mentor/ChatPeople";
import { MentorSelector } from "@/components/mentor/MentorSelector";
import styles from "@/components/mentor/ChatWorkspace.module.css";

export default async function MentorPage({ searchParams }: { searchParams?: Promise<{ mentor?: string }> }) {
  const access = await getChatAccess();
  if (access.isMentor) redirect("/mentor-inbox");
  const params = searchParams ? await searchParams : {};
  const { conversation, mentor, missingMigration, error } = await getOrCreateStudentMentorConversation(params.mentor);
  if (missingMigration || error || !conversation || !mentor) {
    return <section className="flex h-full w-full flex-col items-center justify-center bg-[var(--card)] px-6 py-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Chat tijdelijk niet beschikbaar</h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">{error ?? "We kunnen je gesprek nu niet openen. Probeer het opnieuw of mail ons als je hulp nodig hebt."}</p>
      <div className="mt-6 flex items-center gap-5"><Link href="/mentor" className="cb-btn cb-btn-primary">Opnieuw proberen</Link><a href="mailto:info@hettradeplatform.be" className="text-sm font-medium text-[var(--muted)] underline underline-offset-4">Mail ons</a></div>
    </section>;
  }
  const mentors = await getChatMentors();
  return <ChatPeople profiles={[...mentors, ...conversation.profiles]}><div className={styles.workspace}>
    <MentorSelector mentors={mentors} selectedId={mentor.studentId}/>
    <MentorChatPanel key={mentor.studentId} thread={conversation.thread} messages={conversation.messages} currentStudentId={conversation.currentStudentId} mentorId={mentor.studentId} mentorName={mentor.displayName} hasOlder={conversation.hasOlder} lastReadSeq={conversation.lastReadSeq} chatEmailEnabled={process.env.CHAT_EMAIL_MODE === "live"}/>
  </div></ChatPeople>;
}
