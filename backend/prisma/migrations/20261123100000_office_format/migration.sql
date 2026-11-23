-- CreateEnum
CREATE TYPE "ItemGolongan" AS ENUM ('BG', 'NG');

-- AlterEnum
BEGIN;
CREATE TYPE "AssetCondition_new" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'DAMAGED');
ALTER TABLE "assets" ALTER COLUMN "condition" TYPE "AssetCondition_new" USING (CASE "condition"::text WHEN 'MINOR_DAMAGE' THEN 'NEEDS_REPAIR' WHEN 'MAJOR_DAMAGE' THEN 'DAMAGED' WHEN 'UNUSABLE' THEN 'DAMAGED' ELSE "condition"::text END)::"AssetCondition_new";
ALTER TABLE "asset_loans" ALTER COLUMN "return_condition" TYPE "AssetCondition_new" USING (CASE "return_condition"::text WHEN 'MINOR_DAMAGE' THEN 'NEEDS_REPAIR' WHEN 'MAJOR_DAMAGE' THEN 'DAMAGED' WHEN 'UNUSABLE' THEN 'DAMAGED' ELSE "return_condition"::text END)::"AssetCondition_new";
ALTER TABLE "asset_condition_logs" ALTER COLUMN "condition" TYPE "AssetCondition_new" USING (CASE "condition"::text WHEN 'MINOR_DAMAGE' THEN 'NEEDS_REPAIR' WHEN 'MAJOR_DAMAGE' THEN 'DAMAGED' WHEN 'UNUSABLE' THEN 'DAMAGED' ELSE "condition"::text END)::"AssetCondition_new";
ALTER TABLE "asset_condition_logs" ALTER COLUMN "previous_condition" TYPE "AssetCondition_new" USING (CASE "previous_condition"::text WHEN 'MINOR_DAMAGE' THEN 'NEEDS_REPAIR' WHEN 'MAJOR_DAMAGE' THEN 'DAMAGED' WHEN 'UNUSABLE' THEN 'DAMAGED' ELSE "previous_condition"::text END)::"AssetCondition_new";
ALTER TABLE "stock_opname_items" ALTER COLUMN "expected_condition" TYPE "AssetCondition_new" USING (CASE "expected_condition"::text WHEN 'MINOR_DAMAGE' THEN 'NEEDS_REPAIR' WHEN 'MAJOR_DAMAGE' THEN 'DAMAGED' WHEN 'UNUSABLE' THEN 'DAMAGED' ELSE "expected_condition"::text END)::"AssetCondition_new";
ALTER TABLE "stock_opname_items" ALTER COLUMN "observed_condition" TYPE "AssetCondition_new" USING (CASE "observed_condition"::text WHEN 'MINOR_DAMAGE' THEN 'NEEDS_REPAIR' WHEN 'MAJOR_DAMAGE' THEN 'DAMAGED' WHEN 'UNUSABLE' THEN 'DAMAGED' ELSE "observed_condition"::text END)::"AssetCondition_new";
ALTER TABLE "maintenance_records" ALTER COLUMN "result_condition" TYPE "AssetCondition_new" USING (CASE "result_condition"::text WHEN 'MINOR_DAMAGE' THEN 'NEEDS_REPAIR' WHEN 'MAJOR_DAMAGE' THEN 'DAMAGED' WHEN 'UNUSABLE' THEN 'DAMAGED' ELSE "result_condition"::text END)::"AssetCondition_new";
ALTER TYPE "AssetCondition" RENAME TO "AssetCondition_old";
ALTER TYPE "AssetCondition_new" RENAME TO "AssetCondition";
DROP TYPE "AssetCondition_old";
COMMIT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "golongan" "ItemGolongan",
ADD COLUMN     "is_group" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "number" INTEGER;
-- Existing (test) categories become NG types numbered from 900 upwards; the office import replaces them.
UPDATE "categories" c SET "golongan" = 'NG', "number" = 899 + n.rn
FROM (SELECT id, row_number() OVER (ORDER BY created_at, code) AS rn FROM "categories") n WHERE n.id = c.id;
ALTER TABLE "categories" ALTER COLUMN "golongan" SET NOT NULL, ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "categories" ADD CONSTRAINT "categories_number_check" CHECK ("number" BETWEEN 1 AND 999);

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "acquisition_year" INTEGER,
ADD COLUMN     "source" VARCHAR(300),
ADD COLUMN     "specification" VARCHAR(500);
-- Merk + model become one free "Spesifikasi"; the year comes from the purchase date when there is one.
UPDATE "assets" SET "specification" = NULLIF(trim(concat_ws(' ', "brand", "model")), ''),
  "acquisition_year" = EXTRACT(YEAR FROM "acquisition_date")::int;
ALTER TABLE "assets" DROP COLUMN "brand", DROP COLUMN "model";

-- AlterTable
-- Codes are numbered per prefix now ("NG.A/012/DPC/2023"); the per-year counters of the old INV- codes are dropped.
DELETE FROM "asset_code_sequences";
ALTER TABLE "asset_code_sequences" DROP CONSTRAINT "asset_code_sequences_pkey",
DROP COLUMN "year",
ADD COLUMN     "prefix" VARCHAR(40) NOT NULL,
ADD CONSTRAINT "asset_code_sequences_pkey" PRIMARY KEY ("prefix");

-- CreateTable
CREATE TABLE "group_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "specification" VARCHAR(500),
    "acquisition_year" INTEGER,
    "source" VARCHAR(300),
    "qty_good" INTEGER NOT NULL DEFAULT 0,
    "qty_needs_repair" INTEGER NOT NULL DEFAULT 0,
    "qty_damaged" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "archive_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname_group_lines" (
    "id" UUID NOT NULL,
    "opname_id" UUID NOT NULL,
    "group_item_id" UUID NOT NULL,
    "expected_good" INTEGER NOT NULL,
    "expected_needs_repair" INTEGER NOT NULL,
    "expected_damaged" INTEGER NOT NULL,
    "counted_good" INTEGER,
    "counted_needs_repair" INTEGER,
    "counted_damaged" INTEGER,
    "counted_at" TIMESTAMPTZ(6),
    "counted_by_id" UUID,

    CONSTRAINT "stock_opname_group_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_items_category_id_idx" ON "group_items"("category_id");

-- CreateIndex
CREATE INDEX "group_items_location_id_idx" ON "group_items"("location_id");

-- CreateIndex
CREATE INDEX "group_items_archived_at_idx" ON "group_items"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_group_lines_opname_id_group_item_id_key" ON "stock_opname_group_lines"("opname_id", "group_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_golongan_number_key" ON "categories"("golongan", "number");

-- AddForeignKey
ALTER TABLE "group_items" ADD CONSTRAINT "group_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_items" ADD CONSTRAINT "group_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_group_lines" ADD CONSTRAINT "stock_opname_group_lines_opname_id_fkey" FOREIGN KEY ("opname_id") REFERENCES "stock_opnames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_group_lines" ADD CONSTRAINT "stock_opname_group_lines_group_item_id_fkey" FOREIGN KEY ("group_item_id") REFERENCES "group_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Quantities are never negative.
ALTER TABLE "group_items" ADD CONSTRAINT "group_items_qty_check"
  CHECK ("qty_good" >= 0 AND "qty_needs_repair" >= 0 AND "qty_damaged" >= 0);
ALTER TABLE "stock_opname_group_lines" ADD CONSTRAINT "stock_opname_group_lines_count_check"
  CHECK (coalesce("counted_good", 0) >= 0 AND coalesce("counted_needs_repair", 0) >= 0 AND coalesce("counted_damaged", 0) >= 0);
