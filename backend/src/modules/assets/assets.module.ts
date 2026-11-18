import { Module } from '@nestjs/common';
import { AssetCodeService } from './asset-code.js';
import { AssetFilesController } from './asset-files.controller.js';
import { AssetFilesService } from './asset-files.service.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  controllers: [AssetsController, AssetFilesController],
  providers: [AssetCodeService, AssetsService, AssetFilesService],
  exports: [AssetCodeService, AssetsService, AssetFilesService],
})
export class AssetsModule {}
