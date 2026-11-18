import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { AssetQrController, QrController } from './qr.controller.js';
import { QrService } from './qr.service.js';

@Module({
  imports: [AssetsModule],
  controllers: [AssetQrController, QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
