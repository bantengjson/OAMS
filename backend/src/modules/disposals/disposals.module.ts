import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { DisposalsController } from './disposals.controller.js';
import { DisposalsService } from './disposals.service.js';

@Module({
  imports: [AssetsModule],
  controllers: [DisposalsController],
  providers: [DisposalsService],
  exports: [DisposalsService],
})
export class DisposalsModule {}
