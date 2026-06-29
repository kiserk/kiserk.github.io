// Tunable "species" for the mycelium growth sim. Each species is a different
// growth algorithm/morphology. The renderer reads these numbers every frame, so
// they can be tuned live from the preview page without touching the renderer.

export interface Species {
  /** Display name. */
  name: string;
  /** Pixels a tip advances per growth step (before DPR scaling). */
  step: number;
  /** Per-step probability an apical tip bifurcates into two daughter hyphae. */
  branchProb: number;
  /** Per-step probability a tip stops extending (apical senescence). */
  dieProb: number;
  /** Std-dev (radians) of heading wobble per step — kept small for straight hyphae. */
  angleJitter: number;
  /** Fork half-angle (radians) at a dichotomous bifurcation. */
  branchAngle: number;
  /** Stroke width in CSS px for this species' hyphae. */
  lineWidth: number;
  /**
   * How strongly the mouse "oxygen gradient" pulls headings (0 = ignore,
   * 1 = aim straight at the cursor each step). Kept gentle so growth stays organic.
   */
  oxygenPull: number;
  /** Soft cap on simultaneously-living tips (before vigor densification). */
  maxTips: number;
}

// Three growth morphologies, used with the Neighbour-Sensing tropisms in the
// renderer (negative autotropism, persistence, density-gated branching). They
// start sparse and the colony densifies via "vigor" as it consumes nutrients.
// branchProb is the per-step branch probability *when local density permits*.
// oxygenPull is the species' baseline susceptibility to the mouse field.
export const SPECIES: Species[] = [
  {
    // Open radial colony — long straight runs, occasional lateral branches.
    name: 'airy',
    step: 1.0,
    branchProb: 0.02,
    dieProb: 0.0012,
    angleJitter: 0.06,
    branchAngle: 0.65,
    lineWidth: 0.7,
    oxygenPull: 0.22,
    maxTips: 70,
  },
  {
    // Exploitative thickening — shorter steps, frequent branches (mat fills in).
    name: 'dense',
    step: 0.85,
    branchProb: 0.05,
    dieProb: 0.003,
    angleJitter: 0.12,
    branchAngle: 0.95,
    lineWidth: 0.65,
    oxygenPull: 0.16,
    maxTips: 130,
  },
  {
    // Directed advance — straightest runs, narrow branches (cord-like).
    name: 'fan',
    step: 1.2,
    branchProb: 0.03,
    dieProb: 0.0011,
    angleJitter: 0.035,
    branchAngle: 0.4,
    lineWidth: 0.8,
    oxygenPull: 0.3,
    maxTips: 90,
  },
];

export function speciesByName(name: string): Species | undefined {
  return SPECIES.find((s) => s.name === name);
}

/** Rotate to the next species (wraps). Used when a tip exhausts a nutrient. */
export function nextSpecies(current: Species): Species {
  const i = SPECIES.findIndex((s) => s.name === current.name);
  return SPECIES[(i + 1) % SPECIES.length];
}
