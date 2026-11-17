import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { MasterDataQueryDto } from '../../common/dto/master-data-query.dto.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Daftar kategori' })
  list(@Query() q: MasterDataQueryDto): Promise<Paginated<CategoryDto>> {
    return this.categories.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MASTER_DATA_VIEW)
  @ApiOperation({ summary: 'Detail kategori' })
  @ApiOkResponse({ type: CategoryDto })
  get(@Param('id', ParseUuid) id: string): Promise<CategoryDto> {
    return this.categories.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Tambah kategori' })
  @ApiCreatedResponse({ type: CategoryDto })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Ubah kategori' })
  @ApiOkResponse({ type: CategoryDto })
  update(@Param('id', ParseUuid) id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryDto> {
    return this.categories.update(id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Nonaktifkan kategori' })
  @ApiOkResponse({ type: CategoryDto })
  deactivate(@Param('id', ParseUuid) id: string): Promise<CategoryDto> {
    return this.categories.setActive(id, false);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Aktifkan kategori' })
  @ApiOkResponse({ type: CategoryDto })
  activate(@Param('id', ParseUuid) id: string): Promise<CategoryDto> {
    return this.categories.setActive(id, true);
  }
}
