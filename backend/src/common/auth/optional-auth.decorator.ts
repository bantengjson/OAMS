import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Route is reachable anonymously, but a bearer token, when present, is still
 * fully validated and `req.user` populated (used by the public QR page so
 * staff see more than visitors).
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
