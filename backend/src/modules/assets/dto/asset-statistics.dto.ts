import { ApiProperty } from '@nestjs/swagger';
import type { AssetCondition, AssetStatus } from '../../../generated/prisma/client.js';

export class CountByRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() count!: number;
}

export class AssetStatisticsDto {
  @ApiProperty({ description: 'Semua barang: aktif + diarsipkan + dilepas' }) total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() archived!: number;
  @ApiProperty({ description: 'Barang yang sudah dilepas (tidak diarsipkan)' }) disposed!: number;
  @ApiProperty({ type: Object }) byStatus!: Record<AssetStatus, number>;
  @ApiProperty({ type: Object }) byCondition!: Record<AssetCondition, number>;
  @ApiProperty({ type: [CountByRefDto] }) byCategory!: CountByRefDto[];
  @ApiProperty({ type: [CountByRefDto], description: 'Dikelompokkan per Kantor (akar lokasi)' })
  byOffice!: CountByRefDto[];
  @ApiProperty({ description: 'Barang aktif per tahun perolehan, urut naik' })
  byAcquisitionYear!: { year: number; count: number }[];
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
