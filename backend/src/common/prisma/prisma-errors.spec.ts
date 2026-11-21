import { isSerializationFailure } from './prisma-errors.js';

const prismaError = (code: string, meta?: unknown) =>
  Object.assign(new Error('x'), { name: 'PrismaClientKnownRequestError', code, meta });

describe('isSerializationFailure', () => {
  it('accepts P2034 and a raw query failing with 40001', () => {
    expect(isSerializationFailure(prismaError('P2034'))).toBe(true);
    expect(
      isSerializationFailure(prismaError('P2010', { driverAdapterError: { cause: { originalCode: '40001' } } })),
    ).toBe(true);
  });

  it('rejects other raw query failures and non-Prisma errors', () => {
    expect(
      isSerializationFailure(prismaError('P2010', { driverAdapterError: { cause: { originalCode: '23505' } } })),
    ).toBe(false);
    expect(isSerializationFailure(prismaError('P2010'))).toBe(false);
    expect(isSerializationFailure(new Error('40001'))).toBe(false);
  });
});
