import Link from "next/link";
import { redirect } from "next/navigation";
import { MentorChatPanel } from "@/components/mentor/MentorChatPanel";
import { getChatAccess, getOrCreateStudentMentorConversation } from "@/lib/mentor-chat";

export default async function MentorPage() {
  const access = await getChatAccess();
  if (access.isMentor) redirect("/mentor-inbox");
  const { conversation, mentor, missingMigration, error } = await getOrCreateStudentMentorConversation();
  if (missingMigration || error || !conversation) {
    return <section className="flex h-full w-full flex-col items-center justify-center bg-[var(--card)] px-6 py-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Chat tijdelijk niet beschikbaar</h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">We kunnen je gesprek nu niet openen. Probeer het opnieuw of mail ons als je hulp nodig hebt.</p>
      <div className="mt-6 flex items-center gap-5"><Link href="/mentor" className="cb-btn cb-btn-primary">Opnieuw proberen</Link><a href="mailto:info@hettradeplatform.be" className="text-sm font-medium text-[var(--muted)] underline underline-offset-4">Mail ons</a></div>
    </section>;
  }
  return <MentorChatPanel thread={conversation.thread} messages={conversation.messages} currentStudentId={conversation.currentStudentId} mentorId={mentor?.studentId ?? ""} mentorName={mentor?.displayName ?? "Rousso"} hasOlder={conversation.hasOlder} lastReadSeq={conversation.lastReadSeq} chatEmailEnabled={process.env.CHAT_EMAIL_MODE === "live"}/>;
}
