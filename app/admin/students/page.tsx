import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { StudentsTable } from "@/components/admin/StudentsTable";
import { listStudentsAdmin } from "@/lib/admin/students";
import { requireAdmin } from "@/lib/admin/access";
import type { AdminSortField } from "@/lib/admin/types";

const PAGE_SIZE = 25;

function parseSort(
  raw: string | undefined
): { sortBy: AdminSortField; order: "asc" | "desc" } {
  const sortBy = (
    ["created_at", "access_level", "email"].includes(raw ?? "")
      ? raw
      : "created_at"
  ) as AdminSortField;
  return { sortBy, order: "desc" };
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { actorStudent } = await requireAdmin();
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const sortRaw = typeof sp.sort === "string" ? sp.sort : undefined;
  const orderRaw = typeof sp.order === "string" ? sp.order : undefined;
  const { sortBy } = parseSort(sortRaw);
  const order = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";

  const { rows, total } = await listStudentsAdmin({
    q,
    sortBy,
    order,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("sort", next.sort ?? sortBy);
    params.set("order", next.order ?? order);
    const pageVal = next.page !== undefined ? next.page : page > 1 ? String(page) : undefined;
    if (pageVal && pageVal !== "1") params.set("page", pageVal);
    const s = params.toString();
    return s ? `/admin/students?${s}` : "/admin/students";
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Students" },
        ]}
        eyebrow="Directory"
        title="Students"
        description="Search by name or email, sort the list, and open a profile for full progress control."
      />

      <form
        method="get"
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        role="search"
      >
        <label className="sr-only" htmlFor="student-search">
          Search students
        </label>
        <input
          id="student-search"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Search name or email…"
          className="min-h-[44px] min-w-[min(100%,280px)] flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_22%,transparent)]"
        />
        <input type="hidden" name="sort" value={sortBy} />
        <input type="hidden" name="order" value={order} />
        <button type="submit" className="cb-btn cb-btn-primary">
          Search
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="font-semibold text-[var(--muted)]">Sort:</span>
        {(
          [
            ["created_at", "Joined"],
            ["access_level", "Access level"],
            ["email", "Email"],
          ] as const
        ).map(([key, label]) => {
          const active = sortBy === key;
          const nextOrder = active && order === "desc" ? "asc" : "desc";
          return (
            <Link
              key={key}
              href={buildHref({
                sort: key,
                order: active ? nextOrder : "desc",
                page: "1",
              })}
              className={
                active
                  ? "rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 font-bold text-[var(--foreground)]"
                  : "rounded-full px-3 py-1 font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
              }
            >
              {label}
              {active ? (order === "desc" ? " ↓" : " ↑") : ""}
            </Link>
          );
        })}
      </div>

      <StudentsTable rows={rows} actorStudentId={actorStudent.id} />

      <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] pt-6 sm:flex-row">
        <p className="cb-caption">
          Showing {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, total)} of {total}
        </p>
        <div className="flex gap-2">
          <Link
            href={buildHref({ page: page > 1 ? String(page - 1) : undefined })}
            className={`cb-btn cb-btn-secondary text-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            aria-disabled={page <= 1}
          >
            Previous
          </Link>
          <Link
            href={page < totalPages ? buildHref({ page: String(page + 1) }) : "#"}
            className={`cb-btn cb-btn-secondary text-sm ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            aria-disabled={page >= totalPages}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
