/** McConnell's formula for a 90% confidence interval (PRD §5, Episode III). */
export function computeCI90(expected: number, best: number, worst: number): number {
  return expected + 1.28 * ((worst - best) / 3)
}
