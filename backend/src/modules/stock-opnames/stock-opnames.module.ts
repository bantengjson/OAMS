import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { StockOpnamesController } from './stock-opnames.controller.js';
import { StockOpnamesService } from './stock-opnames.service.js';

@Module({
  imports: [AssetsModule],
  controllers: [StockOpnamesController],
  providers: [StockOpnamesService],
  exports: [StockOpnamesService],
})
export class StockOpnamesModule {}
