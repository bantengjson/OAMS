// @vitest-environment node
import {
  api,
  API_BASE,
  ApiError,
  getAccessToken,
  refreshSession,
  setAccessToken,
  setUnauthorizedHandler,
} from './client';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(status: number, body?: unknown): Response {
  if (body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function urlOf(call: Parameters<typeof fetch>): string {
  const input = call[0];
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function headerOf(call: Parameters<typeof fetch>, name: string): string | null {
  return new Headers(call[1]?.headers).get(name);
}

describe('api client', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(null);
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the bearer token, credentials and query string, and parses JSON', async () => {
    setAccessToken('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [1] }));

    const result = await api.get<{ data: number[] }>('/categories', {
      query: { page: 1, search: undefined, isActive: true },
    });

    expect(result).toEqual({ data: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE}/categories?page=1&isActive=true`);
    expect(call[1]?.method).toBe('GET');
    expect(call[1]?.credentials).toBe('include');
    expect(headerOf(call, 'authorization')).toBe('Bearer tok');
  });

  it('serialises JSON bodies for writes and resolves 204 as undefined', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    const result = await api.post('/auth/logout', { a: 1 });
    expect(result).toBeUndefined();
    const call = fetchMock.mock.calls[0];
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.body).toBe(JSON.stringify({ a: 1 }));
    expect(headerOf(call, 'content-type')).toBe('application/json');
  });

  it('refreshes once on 401 and retries the original request', async () => {
    setAccessToken('old');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Autentikasi diperlukan.' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await api.get('/users');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlOf(fetchMock.mock.calls[1])).toBe(`${API_BASE}/auth/refresh`);
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
    expect(headerOf(fetchMock.mock.calls[2], 'authorization')).toBe('Bearer new');
    expect(getAccessToken()).toBe('new');
  });

  it('calls the unauthorized handler and throws ApiError when the refresh fails', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setAccessToken('old');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Autentikasi diperlukan.' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Sesi tidak valid.' }));

    await expect(api.get('/users')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('does not try to refresh when an /auth/ endpoint itself returns 401', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Email atau password salah.' }));

    await expect(api.post('/auth/login', { email: 'a', password: 'b' })).rejects.toMatchObject({
      status: 401,
      message: 'Email atau password salah.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent refreshes', async () => {
    setAccessToken('old');
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 5));
        return jsonResponse(200, { accessToken: 'fresh' });
      }
      const auth = new Headers(init?.headers).get('authorization');
      return auth === 'Bearer fresh' ? jsonResponse(200, { url }) : jsonResponse(401, {});
    });

    const [a, b] = await Promise.all([api.get('/categories'), api.get('/locations')]);

    expect(refreshCalls).toBe(1);
    expect(a).toEqual({ url: `${API_BASE}/categories` });
    expect(b).toEqual({ url: `${API_BASE}/locations` });
  });

  it('refreshSession deduplicates concurrent callers and returns the session', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return jsonResponse(200, { accessToken: 'boot', user: { id: 'u1' } });
    });

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);

    expect(calls).toBe(1);
    expect(a).toEqual({ accessToken: 'boot', user: { id: 'u1' } });
    expect(b).toBe(a);
    expect(getAccessToken()).toBe('boot');
  });

  it('refreshSession resolves null (no throw) when there is no session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Sesi tidak valid.' }));
    await expect(refreshSession()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('wraps error bodies into ApiError with the field error map', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { message: 'Validasi gagal.', errors: { email: ['Format email tidak valid'] } }),
    );
    const error = await api.post('/users', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Validasi gagal.',
      errors: { email: ['Format email tidak valid'] },
    });
  });

  it('turns a network failure into ApiError status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.get('/health')).rejects.toMatchObject({
      status: 0,
      message: 'Tidak dapat terhubung ke server.',
    });
  });
});
