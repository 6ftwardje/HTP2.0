import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { loadKnowledge } from "@/lib/ai/knowledge";
import {
  TRANSCRIPT_ENRICHMENT_INSTRUCTION,
  TRANSCRIPT_ENRICHMENT_OUTPUT_SCHEMA,
} from "@/lib/transcription/enrichment";
import type { EnrichmentProvider } from "@/lib/ai/transcript-enrichment";

export class AnthropicTranscriptEnrichmentProvider implements EnrichmentProvider {
  constructor(private readonly model: string) {}

  async generate(input: Parameters<EnrichmentProvider["generate"]>[0]) {
    const knowledge = await loadKnowledge("market_insight_enrichment");
    const client = getAnthropicClient();
    const tool: Anthropic.Tool = {
      name: "market_insight_enrichment",
      description: "Maak een brongetrouw redactioneel concept voor menselijke review.",
      input_schema: TRANSCRIPT_ENRICHMENT_OUTPUT_SCHEMA as unknown as Anthropic.Tool["input_schema"],
    };
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 1_000,
      system: `${knowledge}\n\n# Taak\n${TRANSCRIPT_ENRICHMENT_INSTRUCTION}`,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            durationSeconds: input.durationSeconds,
            segments: input.transcript,
          }),
        },
      ],
    });
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) {
      const error = new Error("Anthropic gaf geen structured output terug.") as Error & {
        code: string;
        retryable: boolean;
      };
      error.code = "invalid_provider_output";
      error.retryable = false;
      throw error;
    }
    return {
      output: toolUse.input,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
