import { Module } from '@nestjs/common';
import { AssetCodeService } from './asset-code.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  controllers: [AssetsController],
  providers: [AssetCodeService, AssetsService],
  exports: [AssetCodeService, AssetsService],
})
export class AssetsModule {}
