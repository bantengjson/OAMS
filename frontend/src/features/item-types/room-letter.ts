/** Next room letter, shown before adding: A…Z, then AA, AB, … (the server assigns it). */
export function nextLetter(codes: readonly string[]): string {
  const toNum = (c: string) => c.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
  let n = codes.filter((c) => /^[A-Z]{1,3}$/.test(c)).reduce((m, c) => Math.max(m, toNum(c)), 0) + 1;
  let out = '';
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
