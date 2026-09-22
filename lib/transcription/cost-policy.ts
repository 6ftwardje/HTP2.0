export type TranscriptionCostPolicy = {
  maxEuroPerVideo: number;
  maxEuroPerMonth: number;
  expectedMinutesPerWeek: number;
};

export const DEFAULT_TRANSCRIPTION_COST_POLICY: TranscriptionCostPolicy = {
  maxEuroPerVideo: 2,
  maxEuroPerMonth: 50,
  expectedMinutesPerWeek: 90,
};

export type CostGateInput = {
  estimatedEuro: number | null;
  monthSpendEuro: number;
  priceConfigurationCurrent: boolean;
};

export function evaluateCostGate(
  input: CostGateInput,
  policy = DEFAULT_TRANSCRIPTION_COST_POLICY
): { allowed: true } | { allowed: false; reason: string } {
  if (!input.priceConfigurationCurrent || input.estimatedEuro === null) {
    return { allowed: false, reason: "Actuele prijsconfiguratie ontbreekt." };
  }
  if (input.estimatedEuro < 0 || input.monthSpendEuro < 0) {
    return { allowed: false, reason: "Kostenraming is ongeldig." };
  }
  if (input.estimatedEuro > policy.maxEuroPerVideo) {
    return { allowed: false, reason: "Kostenlimiet per video wordt overschreden." };
  }
  if (input.monthSpendEuro + input.estimatedEuro > policy.maxEuroPerMonth) {
    return { allowed: false, reason: "Maandelijkse kostenlimiet wordt overschreden." };
  }
  return { allowed: true };
}
