import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page harus bilangan bulat' })
  @Min(1, { message: 'page minimal 1' })
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize harus bilangan bulat' })
  @Min(1, { message: 'pageSize minimal 1' })
  @Max(MAX_PAGE_SIZE, { message: `pageSize maksimal ${MAX_PAGE_SIZE}` })
  pageSize: number = 20;
}

export function pageArgs(q: Pick<PaginationQueryDto, 'page' | 'pageSize'>): {
  skip: number;
  take: number;
} {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
