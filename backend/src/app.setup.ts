import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import { requestContextMiddleware } from './common/context/request-context.middleware.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import type { FieldErrors } from './common/filters/http-exception.filter.js';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldErrors {
  const out: FieldErrors = {};
  for (const error of errors) {
    const key = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      out[key] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(out, flattenValidationErrors(error.children, key));
    }
  }
  return out;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'Validasi gagal.',
    errors: flattenValidationErrors(errors),
  });
}

/**
 * Applies the cross-cutting HTTP configuration shared by `main.ts` and the
 * e2e test harness: prefix, cookies, validation, error format, Swagger.
 */
export function configureApp(app: INestApplication): INestApplication {
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set('trust proxy', 1);
  express.disable('x-powered-by');

  app.setGlobalPrefix(API_PREFIX);
  app.use(requestContextMiddleware);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('OAMS API')
    .setDescription('Office Asset Management System - API internal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, config));

  return app;
}
