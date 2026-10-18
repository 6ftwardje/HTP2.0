import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/access";
import snapshot from "@/lib/data/development-board.json";
import { normalizeProjectEntry, PROJECT_URL, type AdminOption, type BoardCycle, type BoardItem, type DevelopmentSnapshot } from "@/lib/product-board";

type ProjectConnection = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: Array<{ id: string; content: { title: string; body: string; url?: string; repository?: { nameWithOwner: string }; assignees?: { nodes: { login: string }[] } } | null; fieldValues: { nodes: Array<{ name: string; field?: { name: string } }> } }>;
};

export async function getDevelopmentBoard(): Promise<DevelopmentSnapshot & { live: boolean; warning: string | null }> {
  const fallback = { ...snapshot, items: snapshot.items as BoardItem[], live: false };
  const token = process.env.GITHUB_PROJECT_READ_TOKEN;
  if (!token) return { ...fallback, warning: null };
  try {
    const items: BoardItem[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 20; page++) {
      const response: Response = await fetch("https://api.github.com/graphql", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query($cursor:String){ user(login:"6ftwardje"){projectV2(number:3){items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{id content{... on Issue{title body url repository{nameWithOwner} assignees(first:10){nodes{login}}} ... on DraftIssue{title body}} fieldValues(first:30){nodes{... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2SingleSelectField{name}}}}}}}}}}`, variables: { cursor } }),
        next: { revalidate: 60 }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("GitHub unavailable");
      const payload: { errors?: unknown[]; data?: { user?: { projectV2?: { items: ProjectConnection } } } } = await response.json();
      const connection: ProjectConnection | undefined = payload.data?.user?.projectV2?.items;
      if (payload.errors?.length || !connection) throw new Error("GitHub unavailable");
      for (const node of connection.nodes) {
        if (!node.content) continue;
        if (node.content.repository && node.content.repository.nameWithOwner !== "6ftwardje/HTP2.0") continue;
        const fields = Object.fromEntries(node.fieldValues.nodes.flatMap(f => f.field ? [[f.field.name.toLowerCase(), f.name]] : []));
        items.push(normalizeProjectEntry({ id: node.id, content: { title: node.content.title, body: node.content.body, url: node.content.url }, status: fields.status, prioriteit: fields.prioriteit, "hTP-fase": fields["htp-fase"], assignees: node.content.assignees?.nodes.map(a => a.login) }));
      }
      if (!connection.pageInfo.hasNextPage) return { items, syncedAt: new Date().toISOString(), projectUrl: PROJECT_URL, live: true, warning: null };
      cursor = connection.pageInfo.endCursor;
    }
    throw new Error("Project too large");
  } catch {
    return { ...fallback, warning: "GitHub is tijdelijk niet bereikbaar. Je ziet de laatst opgeslagen momentopname." };
  }
}

export async function getProductBoard() {
  await requireAdmin();
  const development = await getDevelopmentBoard();
  const db = await createClient();
  const [tasks, cycles, admins] = await Promise.all([
    db.from("product_board_tasks").select("*").order("created_at", { ascending: false }),
    db.from("product_board_cycles").select("*"),
    db.from("students").select("id,name,email").eq("access_level", 3).order("name"),
  ]);
  const people: AdminOption[] = (admins.data ?? []).map(p => ({ id: p.id, name: p.name || p.email }));
  const team: BoardItem[] = (tasks.data ?? []).map(t => ({
    id: t.id, title: t.title, description: t.description, result: t.result, proof: t.proof,
    status: t.status, sourceStatus: "", priority: t.priority, phase: "Team", ownerId: t.owner_id,
    owner: people.find(p => p.id === t.owner_id)?.name ?? "", dueDate: t.due_date,
    url: null, blocker: t.blocker, version: t.version,
  }));
  return { development, team, cycles: (cycles.data ?? []) as BoardCycle[], admins: people, available: !tasks.error && !cycles.error && !admins.error };
}
