import { Module } from '@nestjs/common';
import { AssetCodeService } from './asset-code.js';

@Module({
  providers: [AssetCodeService],
  exports: [AssetCodeService],
})
export class AssetsModule {}
