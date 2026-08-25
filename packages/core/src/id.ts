/**
 * Dependency-free ID generator. Not cryptographically secure — node IDs are
 * structural identifiers, not security tokens.
 */
let counter = 0;

export function createId(prefix = "n"): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}${counter.toString(36)}`;
}

export function resetIdCounterForTests(): void {
  counter = 0;
}
