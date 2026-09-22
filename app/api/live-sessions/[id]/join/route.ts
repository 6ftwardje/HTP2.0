import { NextRequest, NextResponse } from "next/server";
import {
  canAccessSubscriberContent,
  getBillingOverview,
} from "@/lib/billing";
import { liveSessionJoinState } from "@/lib/live-sessions";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { getSiteUrl } from "@/lib/stripe";
import { ensureCurrentStudent } from "@/lib/students";
import { createServiceClient } from "@/lib/supabase/service";
import type { LiveSession } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Props) {
  const siteUrl = getSiteUrl();
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 403 });
  }

  const { student } = await ensureCurrentStudent();
  if (!student) return NextResponse.redirect(`${siteUrl}/`, 303);

  const overview = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, overview)) {
    return NextResponse.redirect(`${siteUrl}/account?subscription=required`, 303);
  }

  const { id } = await params;
  const db = createServiceClient();
  const [{ data: session, error: sessionError }, { data: providerSecret }] =
    await Promise.all([
      db.from("live_sessions").select("*").eq("id", id).maybeSingle(),
      db
        .from("live_session_provider_secrets")
        .select("external_join_url")
        .eq("live_session_id", id)
        .maybeSingle(),
    ]);

  if (sessionError || !session || !session.is_published) {
    return NextResponse.redirect(`${siteUrl}/live-sessions?join=not-found`, 303);
  }
  if (liveSessionJoinState(session as LiveSession) !== "open") {
    return NextResponse.redirect(`${siteUrl}/live-sessions?join=not-open`, 303);
  }
  if (!providerSecret?.external_join_url) {
    return NextResponse.redirect(`${siteUrl}/live-sessions?join=unavailable`, 303);
  }

  // The MVP redirects only after the entitlement check. A later ClickMeeting
  // phase exchanges provider_event_id for a per-student token/autologin URL.
  return NextResponse.redirect(providerSecret.external_join_url, 303);
}
