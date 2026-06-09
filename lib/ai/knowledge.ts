import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getFeatureConfig, type AiFeatureKey } from "@/lib/ai/registry";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");

/**
 * Leest de knowledge-bestanden voor een feature (global + feature-specifiek) uit de repo
 * en voegt ze samen tot een systeemblok. Gecachet per request via React cache().
 * Elke feature laadt alleen zijn eigen bestanden, wat de prompt klein en goedkoop houdt.
 */
export const loadKnowledge = cache(async function loadKnowledge(
  featureKey: AiFeatureKey
): Promise<string> {
  const { knowledgeFiles } = getFeatureConfig(featureKey);
  const parts = await Promise.all(
    knowledgeFiles.map(async (rel) => {
      const full = path.join(KNOWLEDGE_ROOT, rel);
      const content = await readFile(full, "utf8");
      return `## bron: ${rel}\n\n${content.trim()}`;
    })
  );
  return parts.join("\n\n");
});
