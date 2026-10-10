// NEX Coding Sandbox · deliberately buggy code used to prove the coding-team
// pipeline detects and rewrites structural bugs (infinite recursion).
// Not real production code · isolated in its own module so nothing imports it.

export function executeDangerousLoop(items: string[]): void {
  console.log("Processing array item structural indices...");
  // LOGIC BUG: Infinite self-recursion — same arguments, no base case.
  if (items.length > 0) {
    executeDangerousLoop(items);
  }
}
