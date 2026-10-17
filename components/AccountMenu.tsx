"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import { BRAND } from "@/components/ui/Brand";
import { clearChatDrafts } from "@/lib/chat-message-state";
import { ADMIN_ACCESS_LEVEL } from "@/lib/admin/constants";

export function AccountMenu({ name, studentId, avatarPath, accessLevel, onNavigate }: {
  name: string | null; studentId?: string | null; avatarPath?: string | null;
  accessLevel: number | null; onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id = useId(), pathname = usePathname(), displayName = name?.trim() || "Mijn account";
  const active = pathname.startsWith("/account") || pathname.startsWith("/admin");
  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  function close(restore = false) { setOpen(false); if (restore) trigger.current?.focus(); }
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    function outside(e: PointerEvent) { if (!root.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const itemClass = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]";
  function navigate() { close(); onNavigate?.(); }
  return <div ref={root} className="relative mt-auto border-t border-[var(--border)] pt-4"
    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}
    onKeyDown={(e) => {
      if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); close(true); }
      if (open && ["ArrowDown","ArrowUp","Home","End"].includes(e.key)) {
        e.preventDefault(); const nodes=items(), index=nodes.indexOf(document.activeElement as HTMLElement);
        const next=e.key==="Home"?0:e.key==="End"?nodes.length-1:(index+(e.key==="ArrowDown"?1:-1)+nodes.length)%nodes.length;
        nodes[next]?.focus();
      }
    }}>
    {open && <div id={id} role="menu" aria-label="Account" className="absolute bottom-[calc(100%-4px)] left-0 right-0 z-50 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg">
      <Link href="/account" role="menuitem" aria-current={pathname.startsWith("/account")?"page":undefined} className={itemClass} onClick={navigate}><NavigationIcon name="profile"/>Profiel</Link>
      {accessLevel===ADMIN_ACCESS_LEVEL && <Link href="/admin" role="menuitem" aria-current={pathname.startsWith("/admin")?"page":undefined} className={itemClass} onClick={navigate}><NavigationIcon name="admin"/>Admin</Link>}
      <a href={"mailto:"+BRAND.supportEmail} role="menuitem" className={itemClass}><NavigationIcon name="help"/>Hulp nodig?</a>
      <form action="/auth/signout" method="post" onSubmit={() => clearChatDrafts()}>
        <button type="submit" role="menuitem" className={itemClass}><NavigationIcon name="logout"/>Uitloggen</button>
      </form>
    </div>}
    <button ref={trigger} type="button" onClick={() => setOpen(!open)}
      onKeyDown={(e) => { if (!open && ["ArrowDown","ArrowUp"].includes(e.key)) { e.preventDefault(); setOpen(true); } }}
      aria-label={"Accountmenu voor "+displayName} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined}
      className={"flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] "+(active?"bg-[color-mix(in_oklab,var(--accent)_13%,var(--card))] text-[var(--accent-text)]":"text-[var(--foreground)] hover:bg-[var(--surface-hover)]")}>
      <Avatar name={displayName} studentId={studentId??undefined} objectPath={avatarPath} size={36}/>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{displayName}</span><span className="block text-xs text-[var(--muted)]">Mijn account</span></span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d={open?"m5 7 5 5 5-5":"m5 12 5-5 5 5"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  </div>;
}
