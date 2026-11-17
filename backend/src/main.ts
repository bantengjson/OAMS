import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { API_PREFIX, DOCS_PATH, configureApp } from './app.setup.js';
import { EnvService } from './config/env.service.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  const env = app.get(EnvService);
  const port = env.get('PORT');
  await app.listen(port);
  Logger.log(`API siap di http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`Dokumentasi di http://localhost:${port}/${DOCS_PATH}`, 'Bootstrap');
}

await bootstrap();
