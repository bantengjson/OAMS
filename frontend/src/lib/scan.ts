/** 43 base64url characters: the public token the backend puts after `/a/`. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PATH_PATTERN = /^\/a\/([A-Za-z0-9_-]{43})$/;

/**
 * Turns whatever a scanner (or a person) typed into a public token.
 * Accepts the full label URL, just its path, or the bare token.
 */
export function parseScannedValue(raw: string): { token: string } | null {
  const text = raw.trim();
  if (!text) return null;
  if (TOKEN_PATTERN.test(text)) return { token: text };

  let path = text;
  if (/^https?:\/\//i.test(text)) {
    try {
      path = new URL(text).pathname;
    } catch {
      return null;
    }
  }
  const match = PATH_PATTERN.exec(path);
  return match ? { token: match[1] } : null;
}
