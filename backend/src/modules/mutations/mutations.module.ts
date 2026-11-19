import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { MutationsController } from './mutations.controller.js';
import { MutationsService } from './mutations.service.js';

@Module({
  imports: [AssetsModule, EmployeesModule],
  controllers: [MutationsController],
  providers: [MutationsService],
  exports: [MutationsService],
})
export class MutationsModule {}
