/** Folder under the uploads root holding profile photos. */
export const AVATAR_DIR = 'avatars';

/** API path of a user's profile photo; `v` changes with every upload so caches never show the old one. */
export function avatarUrl(userId: string, fileName: string | null): string | null {
  if (!fileName) return null;
  return `/api/v1/users/${userId}/avatar?v=${fileName.replace(/\.webp$/, '')}`;
}
