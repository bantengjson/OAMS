-- CreateEnum
CREATE TYPE "OpnameStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpnameResult" AS ENUM ('PENDING', 'MATCHED', 'CONDITION_DIFFERS', 'NOT_FOUND', 'UNREGISTERED', 'ON_LOAN', 'IN_MAINTENANCE', 'REMOVED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('REPORTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('BROKEN', 'LOST', 'SOLD', 'DONATED', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConditionSource" ADD VALUE 'OPNAME';
ALTER TYPE "ConditionSource" ADD VALUE 'MAINTENANCE';

-- AlterTable
ALTER TABLE "asset_documents" ADD COLUMN     "disposal_id" UUID;

-- AlterTable
ALTER TABLE "asset_photos" ADD COLUMN     "maintenance_id" UUID;

-- CreateTable
CREATE TABLE "stock_opnames" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "notes" TEXT,
    "status" "OpnameStatus" NOT NULL DEFAULT 'OPEN',
    "planned_date" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_opnames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname_officers" (
    "opname_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "stock_opname_officers_pkey" PRIMARY KEY ("opname_id","user_id")
);

-- CreateTable
CREATE TABLE "stock_opname_items" (
    "id" UUID NOT NULL,
    "opname_id" UUID NOT NULL,
    "asset_id" UUID,
    "expected_condition" "AssetCondition",
    "expected_status" "AssetStatus",
    "scanned_at" TIMESTAMPTZ(6),
    "scanned_by_id" UUID,
    "observed_condition" "AssetCondition",
    "result" "OpnameResult" NOT NULL DEFAULT 'PENDING',
    "raw_value" VARCHAR(500),
    "note" TEXT,
    "condition_applied_at" TIMESTAMPTZ(6),
    "condition_log_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_opname_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'REPORTED',
    "description" TEXT NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technician" VARCHAR(150),
    "started_at" TIMESTAMPTZ(6),
    "started_by_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by_id" UUID,
    "cost" DECIMAL(15,2),
    "technician_notes" TEXT,
    "result_condition" "AssetCondition",
    "previous_status" "AssetStatus",
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_disposals" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "reason" "DisposalReason" NOT NULL,
    "disposed_at" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(15,2),
    "recipient" VARCHAR(150),
    "previous_status" "AssetStatus" NOT NULL,
    "label_was_active" BOOLEAN NOT NULL DEFAULT true,
    "disposed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reverted_at" TIMESTAMPTZ(6),
    "reverted_by_id" UUID,
    "revert_reason" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_opnames_status_created_at_idx" ON "stock_opnames"("status", "created_at");

-- CreateIndex
CREATE INDEX "stock_opname_items_opname_id_result_idx" ON "stock_opname_items"("opname_id", "result");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_items_opname_id_asset_id_key" ON "stock_opname_items"("opname_id", "asset_id");

-- CreateIndex
CREATE INDEX "maintenance_records_asset_id_idx" ON "maintenance_records"("asset_id");

-- CreateIndex
CREATE INDEX "maintenance_records_status_reported_at_idx" ON "maintenance_records"("status", "reported_at");

-- CreateIndex
CREATE INDEX "asset_disposals_asset_id_idx" ON "asset_disposals"("asset_id");

-- CreateIndex
CREATE INDEX "asset_disposals_reason_disposed_at_idx" ON "asset_disposals"("reason", "disposed_at");

-- AddForeignKey
ALTER TABLE "asset_photos" ADD CONSTRAINT "asset_photos_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "maintenance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_disposal_id_fkey" FOREIGN KEY ("disposal_id") REFERENCES "asset_disposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_officers" ADD CONSTRAINT "stock_opname_officers_opname_id_fkey" FOREIGN KEY ("opname_id") REFERENCES "stock_opnames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_officers" ADD CONSTRAINT "stock_opname_officers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_opname_id_fkey" FOREIGN KEY ("opname_id") REFERENCES "stock_opnames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_scanned_by_id_fkey" FOREIGN KEY ("scanned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_condition_log_id_fkey" FOREIGN KEY ("condition_log_id") REFERENCES "asset_condition_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_disposed_by_id_fkey" FOREIGN KEY ("disposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_reverted_by_id_fkey" FOREIGN KEY ("reverted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tahap 4: satu sesi opname OPEN, satu pemeliharaan terbuka per barang, satu pelepasan aktif per barang.
CREATE UNIQUE INDEX "stock_opnames_one_open" ON "stock_opnames"((true)) WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "maintenance_one_open" ON "maintenance_records"("asset_id") WHERE "status" IN ('REPORTED', 'IN_PROGRESS');
CREATE UNIQUE INDEX "asset_disposals_one_active" ON "asset_disposals"("asset_id") WHERE "reverted_at" IS NULL;
