import { NextResponse } from "next/server";
import {
  canAccessSubscriberContent,
  getBillingOverview,
} from "@/lib/billing";
import { getSiteUrl } from "@/lib/stripe";
import { ensureCurrentStudent } from "@/lib/students";
import { createServiceClient } from "@/lib/supabase/service";
import type { LiveSession } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

function icsDate(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function icsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(_: Request, { params }: Props) {
  const { student } = await ensureCurrentStudent();
  if (!student) return new NextResponse("Niet ingelogd.", { status: 401 });

  const overview = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, overview)) {
    return new NextResponse("Subscription vereist.", { status: 403 });
  }

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("live_sessions")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data || data.status === "cancelled") {
    return new NextResponse("Livesessie niet gevonden.", { status: 404 });
  }

  const session = data as LiveSession;
  const siteUrl = getSiteUrl();
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cryptoriez//Het Trade Platform//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${session.id}@hettradeplatform`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(session.starts_at)}`,
    `DTEND:${icsDate(session.ends_at)}`,
    `SUMMARY:${icsText(session.title)}`,
    `DESCRIPTION:${icsText(session.description ?? "Weekly Outlook van Het Trade Platform")}`,
    `URL:${siteUrl}/live-sessions`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="weekly-outlook-${session.slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
