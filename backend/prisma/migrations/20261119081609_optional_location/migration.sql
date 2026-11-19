-- DropForeignKey
ALTER TABLE "asset_mutations" DROP CONSTRAINT "asset_mutations_from_location_id_fkey";

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_location_id_fkey";

-- AlterTable
ALTER TABLE "asset_mutations" ALTER COLUMN "from_location_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "location_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
