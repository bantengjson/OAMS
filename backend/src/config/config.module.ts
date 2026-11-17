import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env.js';
import { EnvService } from './env.service.js';

@Global()
@Module({
  providers: [
    {
      provide: EnvService,
      useFactory: () => new EnvService(loadEnv(process.env)),
    },
  ],
  exports: [EnvService],
})
export class AppConfigModule {}
