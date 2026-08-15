export type ScoringMethod = "sum" | "percentage" | "average" | "custom" | "image";

export type InterpretationBand = { min: number; max: number; label: string };

export function parseBands(raw: unknown): InterpretationBand[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((b) => {
    if (!b || typeof b !== "object") return [];
    const o = b as Record<string, unknown>;
    return [
      {
        min: Number(o["min"] ?? 0),
        max: Number(o["max"] ?? 0),
        label: String(o["label"] ?? ""),
      },
    ];
  });
}

/** Evaluate a very small arithmetic expression with the allowed tokens only. */
function evalFormula(formula: string, vars: Record<string, number>): number {
  let expr = formula;
  for (const [k, v] of Object.entries(vars)) {
    expr = expr.replaceAll(`{${k}}`, String(v));
  }
  if (!/^[0-9+\-*/().\s]*$/.test(expr)) throw new Error("Invalid scoring formula");

  const result = Number(new Function(`return (${expr || 0});`)());
  return Number.isFinite(result) ? result : 0;
}

export function computeScore(opts: {
  method: string;
  formula?: string | null;
  rawSum: number;
  maxPossible: number;
  answered: number;
}): number {
  const { method, rawSum, maxPossible, answered } = opts;
  const round = (n: number) => Math.round(n * 100) / 100;
  switch (method) {
    case "percentage":
      return maxPossible > 0 ? round((rawSum / maxPossible) * 100) : 0;
    case "average":
      return answered > 0 ? round(rawSum / answered) : 0;
    case "custom":
      try {
        return round(
          evalFormula(opts.formula ?? "{raw}", {
            raw: rawSum,
            max: maxPossible,
            count: answered,
          }),
        );
      } catch {
        return round(rawSum);
      }
    case "sum":
    default:
      return round(rawSum);
  }
}

export function interpretScore(bands: InterpretationBand[], score: number): string {
  const hit = bands.find((b) => score >= b.min && score <= b.max);
  return hit?.label ?? "";
}

export const SCORING_METHODS: { value: ScoringMethod; label: string; hint: string }[] = [
  { value: "sum", label: "Sum of answers", hint: "Total = sum of all selected answer scores" },
  { value: "percentage", label: "Percentage of maximum", hint: "Total = raw / max × 100" },
  { value: "average", label: "Average per question", hint: "Total = raw / answered questions" },
  {
    value: "custom",
    label: "Custom formula",
    hint: "Use {raw}, {max}, {count} — e.g. ({raw}/{max})*100",
  },
  {
    value: "image",
    label: "Image / Uploaded File",
    hint: "Upload a physical questionnaire image (no digital questions).",
  },
];
