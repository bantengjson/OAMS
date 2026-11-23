import { ApiProperty } from '@nestjs/swagger';
import type { AssetCondition, AssetStatus } from '../../../generated/prisma/client.js';

export class CountByRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() count!: number;
}

export class CountByTypeDto extends CountByRefDto {
  @ApiProperty({ example: 'NG 012 · Kursi Merah' }) label!: string;
}

export class GroupItemsSummaryDto {
  @ApiProperty({ description: 'Jenis barang kelompok aktif' }) types!: number;
  @ApiProperty({ description: 'Jumlah unit barang kelompok aktif' }) units!: number;
}

export class YearCountDto {
  @ApiProperty() year!: number;
  @ApiProperty() count!: number;
}

export class AssetStatisticsDto {
  @ApiProperty({ description: 'Semua barang: aktif + diarsipkan + dilepas' }) total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() archived!: number;
  @ApiProperty({ description: 'Barang yang sudah dilepas (tidak diarsipkan)' }) disposed!: number;
  @ApiProperty({ type: Object }) byStatus!: Record<AssetStatus, number>;
  @ApiProperty({ type: Object }) byCondition!: Record<AssetCondition, number>;
  @ApiProperty({ type: [CountByTypeDto] }) byCategory!: CountByTypeDto[];
  @ApiProperty({ type: [CountByRefDto], description: 'Per ruangan (A · Sekretariat, …)' }) byRoom!: CountByRefDto[];
  @ApiProperty({ type: GroupItemsSummaryDto }) groupItems!: GroupItemsSummaryDto;
  @ApiProperty({ type: [CountByRefDto], description: 'Dikelompokkan per Kantor (akar lokasi)' })
  byOffice!: CountByRefDto[];
  @ApiProperty({ type: [YearCountDto], description: 'Barang aktif per tahun perolehan, urut naik' })
  byAcquisitionYear!: YearCountDto[];
  @ApiProperty({ description: 'Barang aktif tanpa tanggal perolehan' })
  withoutAcquisitionYear!: number;
  @ApiProperty({ description: 'Mutasi berstatus PENDING' }) pendingMutations!: number;
  @ApiProperty({ description: 'Peminjaman berstatus ACTIVE' }) activeLoans!: number;
  @ApiProperty({ description: 'Peminjaman aktif yang lewat rencana kembali (Asia/Jakarta)' })
  overdueLoans!: number;
  @ApiProperty({ nullable: true, description: 'Sesi stock opname yang sedang berjalan' })
  openOpname!: { id: string; name: string; scanned: number; total: number } | null;
  @ApiProperty({ description: 'Laporan kerusakan yang belum dikerjakan' }) openMaintenance!: number;
  @ApiProperty({ description: 'Barang yang sedang diperbaiki' }) inMaintenance!: number;
}
