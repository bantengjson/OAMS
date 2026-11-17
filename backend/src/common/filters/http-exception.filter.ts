import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export type FieldErrors = Record<string, string[]>;

export interface ErrorBody {
  statusCode: number;
  message: string;
  errors?: FieldErrors;
  path: string;
  timestamp: string;
}

interface Normalized {
  status: number;
  message: string;
  errors?: FieldErrors;
}

interface PrismaKnownError extends Error {
  code: string;
  meta?: {
    target?: string[] | string;
    field_name?: string;
    driverAdapterError?: {
      cause?: {
        constraint?: { index?: string; fields?: string[] };
        table?: string;
      };
    };
  };
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Resolves the offending field(s) of a unique violation across Prisma error shapes. */
function uniqueViolationFields(meta: PrismaKnownError['meta']): string[] {
  const fromTarget = fieldsFromTarget(meta?.target);
  if (fromTarget.length > 0) return fromTarget;

  const constraint = meta?.driverAdapterError?.cause?.constraint;
  if (constraint?.fields?.length) return constraint.fields.map(snakeToCamel);
  if (constraint?.index) {
    let name = constraint.index;
    const table = meta?.driverAdapterError?.cause?.table;
    if (table && name.startsWith(`${table}_`)) name = name.slice(table.length + 1);
    name = name.replace(/_key$/, '').replace(/_idx$/, '');
    return [snakeToCamel(name)];
  }
  return [];
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  if (!(error instanceof Error) || error.name !== 'PrismaClientKnownRequestError') {
    return false;
  }
  const code = (error as unknown as { code?: unknown }).code;
  return typeof code === 'string' && /^P\d{4}$/.test(code);
}

function fieldsFromTarget(target: string[] | string | undefined): string[] {
  if (!target) return [];
  if (Array.isArray(target)) return target;
  // Prisma sometimes reports the constraint name, e.g. "users_email_key".
  const match = /^[a-z_]+?_(.+)_key$/.exec(target);
  return [match ? match[1] : target];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { status, message, errors } = this.normalize(exception);
    const path = request.originalUrl ?? request.url;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${path} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      path,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private normalize(exception: unknown): Normalized {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (isPrismaKnownError(exception)) {
      return this.fromPrisma(exception);
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Terjadi kesalahan pada server.',
    };
  }

  private fromHttpException(exception: HttpException): Normalized {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return { status, message: payload };
    }
    const obj = payload as { message?: unknown; errors?: unknown; error?: unknown };
    let message: string;
    if (typeof obj.message === 'string') {
      message = obj.message;
    } else if (Array.isArray(obj.message)) {
      message = obj.message.join(', ');
    } else if (typeof obj.error === 'string') {
      message = obj.error;
    } else {
      message = exception.message;
    }
    const errors =
      obj.errors && typeof obj.errors === 'object' ? (obj.errors as FieldErrors) : undefined;
    return { status, message, errors };
  }

  private fromPrisma(error: PrismaKnownError): Normalized {
    switch (error.code) {
      case 'P2002': {
        const fields = uniqueViolationFields(error.meta);
        const errors =
          fields.length > 0
            ? Object.fromEntries(fields.map((f) => [f, ['Nilai sudah digunakan.']]))
            : undefined;
        return {
          status: HttpStatus.CONFLICT,
          message: 'Data dengan nilai yang sama sudah ada.',
          errors,
        };
      }
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Referensi data tidak valid.',
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Data tidak ditemukan.' };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Terjadi kesalahan pada server.',
        };
    }
  }
}
