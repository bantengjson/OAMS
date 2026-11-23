const LETTERS = /^[A-Z]{1,3}$/;

/** Bijective base-26: A=1 … Z=26, AA=27 … */
function toNumber(code: string): number {
  return [...code].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}

function toLetters(n: number): string {
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** The letter after the highest existing room letter: A…Z, then AA, AB, … Other codes are ignored. */
export function nextRoomLetter(existing: readonly string[]): string {
  const highest = existing.filter((c) => LETTERS.test(c)).reduce((max, c) => Math.max(max, toNumber(c)), 0);
  return toLetters(highest + 1);
}

/** Sort key for room letters: shorter first, then alphabetical (Z before AA). */
export function compareRoomCodes(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b);
}
