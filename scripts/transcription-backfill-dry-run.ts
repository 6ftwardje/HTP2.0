import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildBackfillDryRunReport,
  type BackfillCatalogItem,
} from "../lib/transcription/backfill-dry-run";

async function main() {
  const inputFlag = process.argv.indexOf("--input");
  const inputPath = inputFlag >= 0 ? process.argv[inputFlag + 1] : null;
  if (!inputPath) {
    throw new Error("Gebruik --input <synthetisch-catalogus.json>.");
  }

  const parsed = JSON.parse(await readFile(resolve(inputPath), "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("De catalogus moet een JSON-array zijn.");
  const catalog = parsed as BackfillCatalogItem[];
  for (const [index, item] of catalog.entries()) {
    if (!item || typeof item.internalId !== "string" || typeof item.title !== "string") {
      throw new Error(`Catalogusitem ${index + 1} mist internalId of title.`);
    }
    if (!["mux", "vimeo", "youtube"].includes(item.videoProvider)) {
      throw new Error(`Catalogusitem ${index + 1} heeft een onbekende provider.`);
    }
  }

  const report = buildBackfillDryRunReport(catalog, {
    selectionKey: (_item, index) => `synthetic-item-${String(index + 1).padStart(3, "0")}`,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main();
