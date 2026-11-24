export type ResonanceVisualSignature = {
  id: string;
  seed: number;
  pulseMs: number;
  phase: number;
  rings: number;
  hueIndex: number;
  pattern: "wave" | "orbit" | "mycelium" | "echo";
};

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function makeResonanceVisualSignature(
  ...parts: Array<string | number | null | undefined>
): ResonanceVisualSignature {
  const source = parts.map((part) => String(part ?? "")).join("|");
  const seed = fnv1a(source || "utopy:resonance");
  const patterns: ResonanceVisualSignature["pattern"][] = [
    "wave",
    "orbit",
    "mycelium",
    "echo",
  ];

  return {
    id: `rv:${seed.toString(36)}`,
    seed,
    pulseMs: 1800 + (seed % 2200),
    phase: seed % 360,
    rings: 2 + (seed % 4),
    hueIndex: seed % 5,
    pattern: patterns[seed % patterns.length],
  };
}

export function makeSessionId(prefix = "resonance"): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}:${uuid}`;

  return `${prefix}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}
