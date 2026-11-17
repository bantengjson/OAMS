import { createTestApp } from './utils/app.js';
import type { TestContext } from './utils/app.js';

describe('health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /api/v1/health reports ok', async () => {
    const res = await ctx.http().get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('unknown routes use the shared error shape', async () => {
    const res = await ctx.http().get('/api/v1/nope').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, path: '/api/v1/nope' });
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('serves the Swagger JSON document', async () => {
    const res = await ctx.http().get('/api/docs-json').expect(200);
    expect(res.body.info.title).toBe('OAMS API');
    expect(res.body.paths).toHaveProperty('/api/v1/health');
  });
});
