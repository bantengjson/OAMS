/** The authenticated principal attached to `req.user` by `JwtAuthGuard`. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  departmentId: string | null;
  roles: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export const REFRESH_COOKIE = 'oams_refresh';
