import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context.js';

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Opens the request context; registered first in `configureApp`. */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = headerValue(req.headers['x-request-id']) ?? randomUUID();
  res.setHeader('x-request-id', requestId);
  requestContext.run(
    {
      requestId,
      ip: req.ip ?? null,
      userAgent: headerValue(req.headers['user-agent']),
      actorId: null,
    },
    () => next(),
  );
}
