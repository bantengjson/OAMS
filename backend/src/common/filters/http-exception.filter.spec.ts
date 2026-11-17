import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

interface Captured {
  status: number;
  body: Record<string, unknown>;
}

function runFilter(error: unknown, url = '/api/v1/test'): Captured {
  const captured: Partial<Captured> = {};
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };
  const request = { url: url.replace('/api/v1', ''), originalUrl: url, method: 'GET' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  const filter = new HttpExceptionFilter();
  filter.catch(error, host);
  return captured as Captured;
}

describe('HttpExceptionFilter', () => {
  it('maps Prisma P2002 to 409 with the field name', () => {
    const err = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['email'] },
    });
    const { status, body } = runFilter(err);
    expect(status).toBe(409);
    expect(body).toMatchObject({
      statusCode: 409,
      message: 'Data dengan nilai yang sama sudah ada.',
      errors: { email: ['Nilai sudah digunakan.'] },
      path: '/api/v1/test',
    });
  });

  it('derives the field from a driver-adapter constraint name (Prisma 7 shape)', () => {
    const err = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: {
        modelName: 'User',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'users_email_key' },
            table: 'users',
          },
        },
      },
    });
    const { status, body } = runFilter(err);
    expect(status).toBe(409);
    expect(body).toMatchObject({ errors: { email: ['Nilai sudah digunakan.'] } });
  });

  it('derives the field from driver-adapter constraint fields', () => {
    const err = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: {
        driverAdapterError: {
          cause: { kind: 'UniqueConstraintViolation', constraint: { fields: ['code'] } },
        },
      },
    });
    const { body } = runFilter(err);
    expect(body).toMatchObject({ errors: { code: ['Nilai sudah digunakan.'] } });
  });

  it('maps Prisma P2025 to 404', () => {
    const err = Object.assign(new Error('Record not found'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2025',
      meta: {},
    });
    const { status, body } = runFilter(err);
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, message: 'Data tidak ditemukan.' });
  });

  it('maps HttpException with validation errors to the shared shape', () => {
    const { status, body } = runFilter(
      new BadRequestException({
        message: 'Validasi gagal.',
        errors: { name: ['name harus diisi'] },
      }),
    );
    expect(status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      message: 'Validasi gagal.',
      errors: { name: ['name harus diisi'] },
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('keeps a plain HttpException message without errors', () => {
    const { status, body } = runFilter(new NotFoundException('Pengguna tidak ditemukan.'));
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, message: 'Pengguna tidak ditemukan.' });
    expect(body).not.toHaveProperty('errors');
  });

  it('hides unknown errors behind a generic 500', () => {
    const { status, body } = runFilter(new Error('secret internal detail'));
    expect(status).toBe(500);
    expect(body).toMatchObject({ statusCode: 500, message: 'Terjadi kesalahan pada server.' });
    expect(JSON.stringify(body)).not.toContain('secret internal detail');
  });
});
