import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module.js';
import { AssetCodeService } from './asset-code.js';
import { AssetConditionsController } from './asset-conditions.controller.js';
import { AssetConditionsService } from './asset-conditions.service.js';
import { AssetFilesController } from './asset-files.controller.js';
import { AssetFilesService } from './asset-files.service.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  imports: [EmployeesModule],
  // Static routes (`statistics`) and `:id/...` sub-resources before the generic `:id` handlers.
  controllers: [AssetConditionsController, AssetsController, AssetFilesController],
  providers: [AssetCodeService, AssetsService, AssetFilesService, AssetConditionsService],
  exports: [AssetCodeService, AssetsService, AssetFilesService, AssetConditionsService],
})
export class AssetsModule {}
