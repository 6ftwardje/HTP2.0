import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationList, MarkAllNotificationsRead } from "@/components/notifications/NotificationList";
import { listMyNotifications } from "@/lib/notifications";
import { NOTIFICATION_PAGE_SIZE } from "@/lib/notification-policy";

export default async function NotificationsPage({ searchParams }: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const params=searchParams?await searchParams:{};
  const parsed=Number(params.page??1);
  const page=Number.isInteger(parsed)?Math.min(40001,Math.max(1,parsed)):1;
  const result=await listMyNotifications({offset:(page-1)*NOTIFICATION_PAGE_SIZE});
  const pages=Math.max(1,Math.ceil(result.totalCount/NOTIFICATION_PAGE_SIZE));
  if(!result.error&&page>pages)redirect("/notifications"+(pages>1?"?page="+pages:""));
  const notifications=result.notifications.map(n=>({
    id:n.id,title:n.event?.title??"Melding",description:n.event?.body??"",timestamp:n.created_at,
    read:Boolean(n.read_at),href:n.event?.href??null,type:n.event?.type??"system",
  }));
  return <div>
    <PageHeader title="Meldingen" description="Alles wat nieuw is op het platform. Klik op een melding om er meteen naartoe te springen."
      actions={!result.error?<MarkAllNotificationsRead unreadTotal={result.unreadTotal}/>:undefined}/>
    <p className="mb-6 max-w-[70ch] text-sm leading-6 text-[var(--muted)]">Ongelezen meldingen staan bovenaan. De badge telt alleen meldingen van de laatste 30 dagen; oudere berichten blijven hier beschikbaar.</p>
    {result.error?<section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="cb-item-title">Meldingen tijdelijk niet beschikbaar</h2><p role="alert" className="mt-2 text-sm text-[var(--muted)]">{result.error}</p>
      <Link href={"/notifications?page="+page} className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Opnieuw proberen</Link>
    </section>:<>
      <NotificationList notifications={notifications}/>
      {pages>1&&<nav aria-label="Meldingenpagina’s" className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm">
        {page>1?<Link href={"/notifications?page="+(page-1)} className="cb-btn cb-btn-secondary" aria-label="Vorige pagina meldingen">Vorige</Link>:<span/>}
        <span className="text-[var(--muted)]">Pagina {page} van {pages} · {result.totalCount} meldingen</span>
        {page<pages?<Link href={"/notifications?page="+(page+1)} className="cb-btn cb-btn-secondary" aria-label="Volgende pagina meldingen">Volgende</Link>:<span/>}
      </nav>}
    </>}
  </div>;
}
