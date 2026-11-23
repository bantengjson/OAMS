import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';
import {
  AcquisitionMethod,
  AssetCondition,
  AssetStatus,
  OwnershipType,
} from '../../../generated/prisma/client.js';

export const enumMessage = (name: string, values: object) =>
  `${name} harus salah satu dari: ${Object.keys(values).join(', ')}`;

export const STATUS_LOAN_MANAGED = 'Status ini diatur oleh peminjaman';
export const STATUS_FLOW_MANAGED = 'Status ini diatur oleh pemeliharaan/pelepasan';
const LOAN_STATUSES: readonly AssetStatus[] = [AssetStatus.BORROWED, AssetStatus.RETURNED];
const MAINTENANCE_DISPOSAL_STATUSES: readonly AssetStatus[] = [
  AssetStatus.UNDER_MAINTENANCE,
  AssetStatus.MISSING,
  AssetStatus.DISPOSED,
];
/** Statuses only a flow (loan, maintenance, disposal) may set; never by hand. */
export const FLOW_STATUSES: readonly AssetStatus[] = [...LOAN_STATUSES, ...MAINTENANCE_DISPOSAL_STATUSES];
/** Statuses a person may set by hand. */
export const CREATABLE_STATUSES: readonly AssetStatus[] = Object.values(AssetStatus).filter(
  (s) => !FLOW_STATUSES.includes(s),
);

/** Refuses flow-managed statuses with a message naming the flow that owns them. */
@ValidatorConstraint({ name: 'manualStatus', async: false })
export class IsManualStatus implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && (CREATABLE_STATUSES as readonly string[]).includes(value);
  }
  defaultMessage(args: ValidationArguments): string {
    if ((MAINTENANCE_DISPOSAL_STATUSES as readonly unknown[]).includes(args.value)) return STATUS_FLOW_MANAGED;
    if ((LOAN_STATUSES as readonly unknown[]).includes(args.value)) return STATUS_LOAN_MANAGED;
    return enumMessage('Status', AssetStatus);
  }
}

export const toNumberOrNull = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) return value === '' ? null : value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  return value;
};

/** `YYYY-MM-DD` that exists on the calendar (rejects 2026-02-31 and month 13). */
@ValidatorConstraint({ name: 'calendarDate', async: false })
export class IsCalendarDate implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  defaultMessage(): string {
    return 'Tanggal perolehan tidak valid';
  }
}

/** Decimal(15,2): 13 integer digits. */
export const MAX_PURCHASE_PRICE = 9_999_999_999_999;

export const emptyToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value;

export class CreateAssetDto {
  @ApiProperty({ example: 'Laptop Lenovo ThinkPad' })
  @Transform(trim)
  @IsString({ message: 'Nama barang wajib diisi' })
  @IsNotEmpty({ message: 'Nama barang wajib diisi' })
  @MaxLength(200)
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Kategori tidak valid' })
  categoryId!: string;

  @ApiPropertyOptional({ description: 'Merk/Type/Warna' }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  specification?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  serialNumber?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ enum: OwnershipType })
  @IsEnum(OwnershipType, { message: enumMessage('Kepemilikan', OwnershipType) })
  ownershipType!: OwnershipType;

  @ApiProperty({ enum: AcquisitionMethod })
  @IsEnum(AcquisitionMethod, { message: enumMessage('Metode perolehan', AcquisitionMethod) })
  acquisitionMethod!: AcquisitionMethod;

  @ApiPropertyOptional({ example: '2026-01-15', description: 'Tanggal (YYYY-MM-DD)' })
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal perolehan harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate)
  acquisitionDate?: string | null;

  @ApiPropertyOptional({ example: 15000000 })
  @IsOptional()
  @Transform(toNumberOrNull)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Harga perolehan harus berupa angka' })
  @Min(0, { message: 'Harga perolehan tidak boleh negatif' })
  @Max(MAX_PURCHASE_PRICE, { message: 'Harga perolehan melebihi batas (13 digit)' })
  purchasePrice?: number | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  vendor?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Opsional; kantor tunggal tidak memakainya' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Lokasi tidak valid' })
  locationId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Unit kerja tidak valid' })
  departmentId?: string | null;

  @ApiProperty({ enum: AssetCondition })
  @IsEnum(AssetCondition, { message: enumMessage('Kondisi', AssetCondition) })
  condition!: AssetCondition;

  @ApiProperty({ enum: CREATABLE_STATUSES })
  @Validate(IsManualStatus)
  status!: AssetStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Penanggung jawab tidak valid' })
  responsibleEmployeeId?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000)
  notes?: string | null;
}
