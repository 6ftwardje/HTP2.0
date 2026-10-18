"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBoardCycle, saveTeamTask } from "@/app/actions/admin/product-board";
import { BOARD_STATUSES, STATUS_LABELS, type AdminOption, type BoardCycle, type BoardItem, type BoardKind, type BoardStatus, type DevelopmentSnapshot } from "@/lib/product-board";
import styles from "./ProductBoard.module.css";

type Props = {
  board: BoardKind; development: DevelopmentSnapshot & { live: boolean; warning: string | null };
  team: BoardItem[]; cycles: BoardCycle[]; admins: AdminOption[]; available: boolean;
};
const hints: Record<BoardStatus, string> = {
  todo: "Ideeën en werk dat klaarstaat", doing: "Hier werken we nu aan", review: "Klaar voor test of feedback",
  done: "Afgerond volgens de bron", blocked: "Een besluit of hulp nodig",
};
const priorityLabels: Record<string, string> = { P0: "Kritiek", P1: "Hoog", P2: "Normaal", P3: "Laag" };
function date(value: string) { return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function ConflictRecovery({ board }: { board: BoardKind }) {
  return <div className={styles.full}><p className={styles.help}>Bewaar eerst je invoer als je die wilt overnemen. Opnieuw laden sluit dit formulier en toont de nieuwste wijzigingen.</p><a className={styles.textButton} href={`/admin/product-board${board === "team" ? "?board=team" : ""}`}>Nieuwste bord laden</a></div>;
}
const newTask: BoardItem = { id: "new", title: "", description: "", result: "", proof: "", status: "todo", sourceStatus: "", priority: "P2", phase: "Team", owner: "", ownerId: null, dueDate: null, url: null, blocker: "", version: 0 };

export function ProductBoard({ board, development, team, cycles, admins, available }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState("");
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState("");
  const [editing, setEditing] = useState<BoardItem | null>(null);
  const [cycleEditing, setCycleEditing] = useState(false);
  const [cycleDraft, setCycleDraft] = useState<BoardCycle | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const cycleRef = useRef<HTMLDivElement>(null);
  const cycle = cycles.find(c => c.board === board);
  const items = board === "development" ? development.items : team;
  const phases = [...new Set(items.map(i => i.phase))].sort((a,b) => a.localeCompare(b, "nl", { numeric: true }));
  const visible = items.filter(item => (!phase || item.phase === phase) && (!status || item.status === status) && (!mine || item.ownerId === mine) && `${item.title} ${item.description} ${item.owner}`.toLocaleLowerCase("nl").includes(search.toLocaleLowerCase("nl")));
  const done = items.filter(i => i.status === "done").length;
  const percent = items.length ? Math.round(done / items.length * 100) : 0;
  const filtered = Boolean(search || phase || status || mine);

  useEffect(() => {
    if (editing) { editorRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); editorRef.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus(); }
    if (cycleEditing) cycleRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, [editing, cycleEditing]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && !editing && !cycleEditing && !busy) router.refresh(); }, 60000);
    return () => clearInterval(timer);
  }, [router, editing, cycleEditing, busy]);

  function startEdit(item: BoardItem) { setEditing(item); setCycleEditing(false); setError(""); setNotice(""); setConflicted(false); }
  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const result = await saveTeamTask(editing.id === "new" ? null : editing.id, editing.version, data);
      if (!result.success) { setError(result.error ?? "Opslaan lukt niet. Probeer opnieuw."); setConflicted(Boolean(result.conflict)); return; }
      setEditing(null); setNotice("Taak opgeslagen. Alle admins zien deze wijziging."); router.refresh();
    } catch { setError("Geen verbinding. Je invoer blijft staan; probeer opnieuw."); }
    finally { setBusy(false); }
  }
  async function submitCycle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const result = await saveBoardCycle(cycleDraft?.version ?? 0, data);
      if (!result.success) { setError(result.error ?? "Opslaan lukt niet. Probeer opnieuw."); setConflicted(Boolean(result.conflict)); return; }
      setCycleEditing(false); setNotice("Doel, werkperiode en feedback opgeslagen."); router.refresh();
    } catch { setError("Geen verbinding. Je invoer blijft staan; probeer opnieuw."); }
    finally { setBusy(false); }
  }

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><h1>Productbord</h1><p>Van idee naar resultaat. Volg het werk, bespreek wat blokkeert en stuur samen bij.</p></div>
      <button type="button" className="cb-btn cb-btn-secondary" disabled={busy} onClick={() => { router.refresh(); setNotice("Het bord wordt vernieuwd."); }}>Vernieuwen</button>
    </header>

    <nav className={styles.tabs} aria-label="Productborden">
      <Link href="/admin/product-board" aria-current={board === "development" ? "page" : undefined}>Development <span>{development.items.length}</span></Link>
      <Link href="/admin/product-board?board=team" aria-current={board === "team" ? "page" : undefined}>Teamtaken <span>{team.length}</span></Link>
    </nav>

    {!available && <div role="alert" className={styles.alert}>Teamtaken en doelen zijn nog niet beschikbaar. Laat de productbordmigratie en databasetoegang controleren en vernieuw daarna het bord. Development blijft beschikbaar.</div>}
    {board === "development" && <div className={styles.source}>
      <p><strong>{development.live ? "GitHub-project" : "GitHub-momentopname"}</strong> · Bijgewerkt {new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Brussels" }).format(new Date(development.syncedAt))}</p>
      <a href={development.projectUrl} target="_blank" rel="noreferrer">Open GitHub-project</a>
      <p className={styles.sourceNote}>{development.warning ?? (development.live ? "Wordt elke minuut opnieuw opgehaald. Statuswijzigingen gebeuren in GitHub." : "Dit is een opgeslagen stand. Voor de nieuwste status open je GitHub; een beheerder kan de momentopname vernieuwen.")}</p>
    </div>}
    {board === "team" && <p className={styles.intro}>Voor content, dienstverlening, events en andere teamtaken. Deze taken staan los van GitHub en zijn gedeeld met alle admins.</p>}

    <section className={styles.cycle} aria-labelledby="cycle-heading">
      <div className={styles.sectionHead}><h2 id="cycle-heading">Ons doel voor deze werkperiode</h2><button type="button" className={styles.textButton} disabled={!available || busy} onClick={() => { if (!cycleEditing) setCycleDraft(cycle ? { ...cycle } : null); setCycleEditing(!cycleEditing); setEditing(null); setError(""); setConflicted(false); }}>{cycleEditing ? "Sluiten" : cycle?.goal ? "Doel en feedback aanpassen" : "Werkperiode instellen"}</button></div>
      {!cycleEditing ? <>
        <p className={styles.goal}>{cycle?.goal || "Spreek één gezamenlijk doel af voordat je het werk verdeelt."}</p>
        {cycle?.starts_on && cycle?.ends_on && <p className={styles.period}>{date(cycle.starts_on)} – {date(cycle.ends_on)}</p>}
        {cycle?.feedback && <div className={styles.feedback}><strong>Feedback & volgende stap</strong><p>{cycle.feedback}</p></div>}
      </> : <div ref={cycleRef}><form onSubmit={submitCycle} className={styles.form}>
        <input type="hidden" name="board" value={board} />
        <label className={styles.full}>Wat willen we bereiken?<textarea name="goal" defaultValue={cycleDraft?.goal} required minLength={5} maxLength={1000} rows={2} placeholder="Bijvoorbeeld: het team kan de nieuwe marktupdateflow zelfstandig testen." /></label>
        <label>Startdatum<input name="starts_on" type="date" required defaultValue={cycleDraft?.starts_on ?? ""} /></label>
        <label>Einddatum<input name="ends_on" type="date" required defaultValue={cycleDraft?.ends_on ?? ""} /></label>
        <label className={styles.full}>Feedback & volgende stap<textarea name="feedback" defaultValue={cycleDraft?.feedback} rows={3} maxLength={3000} placeholder="Wat leerden we uit de test? Wat passen we aan?" /></label>
        <p className={`${styles.help} ${styles.full}`}>Dit doel hoort bij dit bord. De kaarten en totale voortgang blijven zichtbaar over werkperiodes heen. Kopieer eerdere feedback als je die wilt bewaren voordat je een nieuwe periode instelt.</p>
        {error && <p role="alert" className={styles.full}>{error}</p>}
        {conflicted && <ConflictRecovery board={board} />}
        <div className={`${styles.actions} ${styles.full}`}><button className="cb-btn cb-btn-primary" disabled={busy}>{busy ? "Opslaan…" : "Werkperiode opslaan"}</button><button type="button" className="cb-btn cb-btn-secondary" disabled={busy} onClick={() => { setCycleEditing(false); setError(""); }}>Annuleren</button></div>
      </form></div>}
    </section>

    <section aria-label="Totale voortgang" className={styles.progress}>
      <div><strong>{done} van {items.length} klaar</strong><span>Totale voortgang · {percent}%</span></div>
      <progress value={done} max={items.length || 1} aria-label="Afgeronde taken" />
      <p>{board === "development" ? "‘Klaar’ volgt de projectstatus in GitHub en betekent niet automatisch dat een feature al live staat." : "Rond een taak af met een toetsbaar resultaat en bewijs of feedback."}</p>
      {items.some(i => i.status === "blocked") && <button type="button" className={styles.textButton} onClick={() => { setStatus("blocked"); setSearch(""); setPhase(""); setMine(""); }}>Bekijk {items.filter(i => i.status === "blocked").length} geblokkeerde taken</button>}
    </section>

    <div className={styles.toolbar}>
      <label className={styles.search}>Zoeken<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek een taak of resultaat…" /></label>
      {board === "development" && <label>Fase<select value={phase} onChange={e => setPhase(e.target.value)}><option value="">Alle fasen</option>{phases.map(p => <option key={p}>{p}</option>)}</select></label>}
      {board === "team" && <label>Eigenaar<select value={mine} onChange={e => setMine(e.target.value)}><option value="">Iedereen</option>{admins.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
      <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Alle statussen</option>{BOARD_STATUSES.map(s => <option value={s} key={s}>{STATUS_LABELS[s]}</option>)}</select></label>
      {board === "team" && <button type="button" className="cb-btn cb-btn-primary" disabled={!available || busy} onClick={() => startEdit({ ...newTask })}>Taak toevoegen</button>}
    </div>

    {editing && <section ref={editorRef} className={styles.editor} aria-labelledby="task-editor-heading">
      <h2 id="task-editor-heading">{editing.id === "new" ? "Nieuwe teamtaak" : "Teamtaak aanpassen"}</h2>
      <form key={`${editing.id}-${editing.version}`} onSubmit={submitTask} className={styles.form}>
        <label className={styles.full}>Titel<input name="title" defaultValue={editing.title} required minLength={3} maxLength={160} placeholder="Bijvoorbeeld: feedbacksessie met mentoren organiseren" /></label>
        <label className={styles.full}>Omschrijving<textarea name="description" defaultValue={editing.description} maxLength={3000} rows={2} /></label>
        <label className={styles.full}>Wanneer is dit geslaagd?<textarea name="result" defaultValue={editing.result} maxLength={3000} rows={2} placeholder="Beschrijf het resultaat dat we kunnen testen of beoordelen." /></label>
        <label>Status<select name="status" defaultValue={editing.status}>{BOARD_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
        <label>Prioriteit<select name="priority" defaultValue={editing.priority}>{["P1", "P2", "P3"].map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}</select></label>
        <label>Eigenaar<select name="owner_id" defaultValue={editing.ownerId ?? ""}><option value="">Nog te verdelen</option>{admins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Deadline<input name="due_date" type="date" defaultValue={editing.dueDate ?? ""} /></label>
        <label className={styles.full}>Blokkade & volgende actie<textarea name="blocker" defaultValue={editing.blocker} maxLength={3000} rows={2} placeholder="Verplicht bij ‘Geblokkeerd’: wat is nodig en wie pakt dit op?" /></label>
        <label className={styles.full}>Bewijs of feedback<textarea name="proof" defaultValue={editing.proof} maxLength={3000} rows={2} placeholder="Verplicht bij ‘Klaar’: wat hebben we getoetst en wat was het resultaat?" /></label>
        {error && <p role="alert" className={styles.full}>{error}</p>}
        {conflicted && <ConflictRecovery board={board} />}
        <div className={`${styles.actions} ${styles.full}`}><button className="cb-btn cb-btn-primary" disabled={busy}>{busy ? "Opslaan…" : "Taak opslaan"}</button><button className="cb-btn cb-btn-secondary" disabled={busy} type="button" onClick={() => { setEditing(null); setError(""); }}>Annuleren</button></div>
      </form>
    </section>}
    <p role="status" className={styles.notice}>{notice}</p>

    <div className={styles.boardHead}><h2>{board === "development" ? "Nieuwe features & verbeteringen" : "Ons teamwerk"}</h2><p>{visible.length} {filtered ? `van ${items.length} taken` : "taken"}{filtered && <button className={styles.textButton} type="button" onClick={() => { setSearch(""); setStatus(""); setMine(""); setPhase(""); }}>Filters wissen</button>}</p></div>
    {visible.length === 0 && <div className={styles.empty}><h3>{filtered ? "Geen taken met deze filters" : board === "team" ? "Maak de eerste teamtaak" : "Er staan nog geen developmenttaken op dit bord"}</h3><p>{filtered ? "Pas je zoekterm of filters aan om meer werk te zien." : board === "team" ? "Begin met een idee, voeg een eigenaar toe en maak duidelijk wanneer het geslaagd is." : "Controleer het GitHub-project en vernieuw de momentopname."}</p></div>}
    <div className={styles.board} aria-label={board === "development" ? "Development scrumboard" : "Team scrumboard"}>
      {BOARD_STATUSES.filter(s => !status || status === s).map(s => <section className={styles.column} data-status={s} key={s} aria-labelledby={`column-${s}`}>
        <div className={styles.columnHead}><h3 id={`column-${s}`}><span className={styles.dot} aria-hidden="true" />{STATUS_LABELS[s]}</h3><span className={styles.count}>{visible.filter(i => i.status === s).length}</span></div>
        <p className={styles.columnHint}>{hints[s]}</p>
        <div className={styles.tasks}>{visible.filter(i => i.status === s).map(item => <article key={item.id} className={styles.task}>
          <div className={styles.taskMeta}><span>{board === "development" ? item.phase : priorityLabels[item.priority]}</span>{board === "development" && item.priority && <span>{priorityLabels[item.priority] ?? item.priority}</span>}{item.sourceStatus === "Ready" && <span>Startklaar</span>}</div>
          <h4>{item.title}</h4>
          {item.description && <p className={styles.taskDescription}>{item.description}</p>}
          {(item.owner || board === "team") && <p className={styles.owner}>{item.owner || "Nog te verdelen"}</p>}
          {item.dueDate && <p className={styles.deadline}>Deadline {date(item.dueDate)}</p>}
          {item.blocker && <p className={styles.blocker}>{item.blocker}</p>}
          {board === "team" && (item.result || item.proof) && <details className={styles.details}><summary>Resultaat & feedback</summary>{item.result && <p><strong>Geslaagd als</strong><br />{item.result}</p>}{item.proof && <p><strong>Bewijs of feedback</strong><br />{item.proof}</p>}</details>}
          <div className={styles.taskActions}>{board === "development" ? <a href={item.url ?? development.projectUrl} target="_blank" rel="noreferrer">{item.url ? "Bekijk issue" : "Bekijk projectkaart"}</a> : <button disabled={!available || busy} className={styles.textButton} type="button" aria-label={`Taak aanpassen: ${item.title}`} onClick={() => startEdit(item)}>Aanpassen / verplaatsen</button>}</div>
        </article>)}</div>
        {visible.filter(i => i.status === s).length === 0 && <p className={styles.columnEmpty}>Geen taken{filtered ? " met deze filters" : ""}.</p>}
      </section>)}
    </div>
    <details className={styles.explainer}><summary>Zo gebruiken we dit bord</summary><p>Spreek een doel en een korte werkperiode af. Verdeel het werk en beperk wat tegelijk bezig is. Laat het resultaat testen bij ‘Te controleren’. Leg feedback vast, rond pas daarna af en gebruik wat je leert voor de volgende periode.</p><p>Development volgt GitHub, inclusief conceptkaarten en geblokkeerd werk. Teamtaken beheer je hier. Admins zien nieuwe wijzigingen binnen één minuut of via ‘Vernieuwen’.</p></details>
  </div>;
}
