import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  /** Authenticated user id, set by the auth guard once the token is verified. */
  actorId: string | null;
}

class RequestContextStore {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  setActor(actorId: string | null): void {
    const store = this.storage.getStore();
    if (store) store.actorId = actorId;
  }
}

/** Per-request context (actor, ip, user agent) available anywhere in the call chain. */
export const requestContext = new RequestContextStore();
