import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  let ready = false;
  try {
    const { error } = await createServiceClient().from('modules').select('id').limit(0).abortSignal(AbortSignal.timeout(5000));
    ready = !error;
  } catch { /* Return only readiness, never credentials or database errors. */ }
  return NextResponse.json({ ok: ready, environment: process.env.HTP_ENVIRONMENT ?? 'production',
    commit: process.env.HTP_RELEASE_SHA ?? process.env.COMMIT_REF ?? 'unknown' },
  { status: ready ? 200 : 503, headers: { 'Cache-Control':'no-store', 'X-Robots-Tag':'noindex, nofollow, noarchive' } });
}
