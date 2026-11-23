import { AssetCodeService } from '../src/modules/assets/asset-code.js';
import { createTestApp } from './utils/app.js';
import type { TestContext } from './utils/app.js';

describe('asset code sequence (e2e)', () => {
  let ctx: TestContext;
  let service: AssetCodeService;

  beforeAll(async () => {
    ctx = await createTestApp();
    service = ctx.app.get(AssetCodeService);
    await ctx.prisma.assetCodeSequence.deleteMany({ where: { prefix: { in: ['INV-2090', 'INV-2091'] } } });
  });

  afterAll(async () => {
    await ctx.prisma.assetCodeSequence.deleteMany({ where: { prefix: { in: ['INV-2090', 'INV-2091'] } } });
    await ctx.close();
  });

  it('hands out distinct consecutive codes under concurrency', async () => {
    const codes = await Promise.all(
      Array.from({ length: 25 }, () =>
        ctx.prisma.$transaction((tx) => service.next(tx, 2090)),
      ),
    );
    expect(new Set(codes).size).toBe(25);
    const numbers = codes.map((c) => Number(c.split('-')[2])).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(codes.every((c) => /^INV-2090-\d{4,}$/.test(c))).toBe(true);
  });

  it('starts every year at 0001 and continues the old year where it left off', async () => {
    expect(await ctx.prisma.$transaction((tx) => service.next(tx, 2091))).toBe('INV-2091-0001');
    expect(await ctx.prisma.$transaction((tx) => service.next(tx, 2090))).toBe('INV-2090-0026');
  });

  it('does not consume a number when the surrounding transaction rolls back', async () => {
    await expect(
      ctx.prisma.$transaction(async (tx) => {
        await service.next(tx, 2091);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await ctx.prisma.$transaction((tx) => service.next(tx, 2091))).toBe('INV-2091-0002');
  });
});
