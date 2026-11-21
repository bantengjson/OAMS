/** Login URL that brings the user back to the page they asked for, query string included. */
export function loginRedirect(pathname: string, search: string): string {
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}
