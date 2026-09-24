import { NextResponse } from "next/server";
import { getCurrentStudent } from "@/lib/students";
import { canAccessSubscriberContent, getBillingOverview } from "@/lib/billing";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id: idRaw, index: indexRaw } = await params;
  const id = Number(idRaw);
  const index = Number(indexRaw);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(index) || index < 0 || index > 3) {
    return new NextResponse(null, { status: 404 });
  }
  const { student } = await getCurrentStudent();
  if (!student) return new NextResponse(null, { status: 401 });
  const overview = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, overview)) return new NextResponse(null, { status: 403 });

  const service = createServiceClient();
  const { data: update } = await service.from("weekly_updates")
    .select("image_paths,is_published,content_format")
    .eq("id", id).eq("content_format", "chart").maybeSingle();
  if (!update || (!update.is_published && student.access_level !== 3)) return new NextResponse(null, { status: 404 });
  const path = (update.image_paths as string[])[index];
  if (!path?.startsWith(`weekly-updates/${id}/`)) return new NextResponse(null, { status: 404 });
  const { data: image, error } = await service.storage.from("market-update-charts").download(path);
  if (error || !image) return new NextResponse(null, { status: 404 });
  return new NextResponse(image, {
    headers: {
      "Content-Type": image.type || "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Cookie",
    },
  });
}
