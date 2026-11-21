/** The authenticated principal attached to `req.user` by `JwtAuthGuard`. */
export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  departmentId: string | null;
  /** API path of the profile photo (with a cache-busting version), or null for initials. */
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  roles: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export const REFRESH_COOKIE = 'oams_refresh';
