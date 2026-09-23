"use server";

import { createHmac } from "node:crypto";
import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";
import {
  buildBackfillDryRunReport,
  validateBackfillSelection,
  type BackfillCatalogItem,
  type BackfillDryRunReport,
  type BackfillTranscriptState,
} from "@/lib/transcription/backfill-dry-run";

export type BackfillDryRunActionResult =
  | { success: true; report: BackfillDryRunReport }
  | { success: false; error: string };

async function loadBackfillReport(): Promise<BackfillDryRunActionResult> {
  const signingSecret = process.env.BACKFILL_DRY_RUN_SIGNING_SECRET?.trim();
  if (!signingSecret || signingSecret.length < 32) {
    return {
      success: false,
      error: "De server-only dry-run-signingsleutel ontbreekt of is te kort.",
    };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("weekly_updates")
    .select(`
      id,
      title,
      video_provider,
      video_url,
      video_duration_seconds,
      mux_asset_id,
      mux_playback_id,
      mux_status,
      updated_at,
      transcripts:ai_video_transcripts(status, updated_at)
    `)
    .order("created_at", { ascending: true });
  if (error) {
    return { success: false, error: "De read-only video-inventaris kon niet worden geladen." };
  }

  const catalog = (data ?? []).map((row): BackfillCatalogItem & { version: string } => {
    const transcripts = [...((row.transcripts ?? []) as Array<{
      status: BackfillTranscriptState;
      updated_at: string;
    }>)]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return {
      internalId: String(row.id),
      version: row.updated_at as string,
      title: row.title as string,
      videoProvider: row.video_provider as BackfillCatalogItem["videoProvider"],
      videoUrl: row.video_url as string | null,
      durationSeconds: row.video_duration_seconds as number | null,
      muxAssetId: row.mux_asset_id as string | null,
      muxPlaybackId: row.mux_playback_id as string | null,
      muxStatus: row.mux_status as BackfillCatalogItem["muxStatus"],
      transcriptStatus: transcripts[0]?.status ?? null,
    };
  });

  return {
    success: true,
    report: buildBackfillDryRunReport(catalog, {
      selectionKey: (item) => {
        const version = (item as BackfillCatalogItem & { version: string }).version;
        return createHmac("sha256", signingSecret)
          .update(`weekly-update:${item.internalId}:${version}`)
          .digest("hex");
      },
    }),
  };
}

export async function adminPreviewLegacyBackfill(): Promise<BackfillDryRunActionResult> {
  await requireAdmin();
  return loadBackfillReport();
}

export async function adminPrepareLegacyBackfillSelection(
  selectionKeys: string[],
  confirmed: boolean
): Promise<
  | {
      success: true;
      proposal: { selected: number; durationMinutes: number; costUpperBoundEuro: number };
    }
  | { success: false; error: string }
> {
  await requireAdmin();
  if (!confirmed) return { success: false, error: "Expliciete bevestiging ontbreekt." };
  if (!Array.isArray(selectionKeys) || selectionKeys.some((key) => !/^[a-f0-9]{64}$/.test(key))) {
    return { success: false, error: "De selectie bevat een ongeldige sleutel." };
  }
  if (selectionKeys.length === 0) {
    return { success: false, error: "Selecteer minimaal één eligible item." };
  }
  const loaded = await loadBackfillReport();
  if (!loaded.success) return loaded;
  const validation = validateBackfillSelection(loaded.report, selectionKeys);
  if (!validation.ok) return { success: false, error: validation.reason };
  const selected = loaded.report.items.filter((item) =>
    validation.selectionKeys.includes(item.selectionKey)
  );
  return {
    success: true,
    proposal: {
      selected: selected.length,
      durationMinutes: selected.reduce((total, item) => total + (item.durationMinutes ?? 0), 0),
      costUpperBoundEuro: selected.reduce((total, item) => total + item.costUpperBoundEuro, 0),
    },
  };
}
