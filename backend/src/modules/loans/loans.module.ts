import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { LoansController } from './loans.controller.js';
import { LoansService } from './loans.service.js';

@Module({
  imports: [AssetsModule, EmployeesModule],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
