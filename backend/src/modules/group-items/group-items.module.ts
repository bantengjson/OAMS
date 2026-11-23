import { Module } from '@nestjs/common';
import { AssetCodeService } from '../assets/asset-code.js';
import { GroupItemsController } from './group-items.controller.js';
import { GroupItemsService } from './group-items.service.js';

@Module({
  controllers: [GroupItemsController],
  providers: [GroupItemsService, AssetCodeService],
  exports: [GroupItemsService],
})
export class GroupItemsModule {}
