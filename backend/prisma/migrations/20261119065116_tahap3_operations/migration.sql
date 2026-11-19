/*
  Warnings:

  - You are about to drop the column `responsible_user_id` on the `assets` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MutationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED');

-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('EMPLOYEE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('CREATE', 'MUTATION');

-- CreateEnum
CREATE TYPE "ConditionSource" AS ENUM ('CREATE', 'MANUAL', 'LOAN_RETURN');

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_responsible_user_id_fkey";

-- DropIndex
DROP INDEX "assets_responsible_user_id_idx";

-- AlterTable
ALTER TABLE "asset_photos" ADD COLUMN     "condition_log_id" UUID;

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "responsible_user_id",
ADD COLUMN     "responsible_employee_id" UUID;

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "employee_number" VARCHAR(30),
    "full_name" VARCHAR(150) NOT NULL,
    "department_id" UUID,
    "position" VARCHAR(100),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "from_employee_id" UUID,
    "to_employee_id" UUID,
    "source" "AssignmentSource" NOT NULL,
    "mutation_id" UUID,
    "note" TEXT,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_mutations" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "status" "MutationStatus" NOT NULL DEFAULT 'PENDING',
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID,
    "changes_responsible" BOOLEAN NOT NULL DEFAULT false,
    "from_responsible_employee_id" UUID,
    "to_responsible_employee_id" UUID,
    "reason" TEXT NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_loans" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "borrower_type" "BorrowerType" NOT NULL,
    "borrower_employee_id" UUID,
    "borrower_name" VARCHAR(150) NOT NULL,
    "borrower_department_id" UUID,
    "borrower_contact" VARCHAR(100),
    "guarantor_employee_id" UUID,
    "purpose" TEXT,
    "loaned_at" DATE NOT NULL,
    "due_at" DATE NOT NULL,
    "returned_at" TIMESTAMPTZ(6),
    "return_condition" "AssetCondition",
    "return_notes" TEXT,
    "previous_status" "AssetStatus" NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "returned_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_condition_logs" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "condition" "AssetCondition" NOT NULL,
    "previous_condition" "AssetCondition",
    "notes" TEXT,
    "checked_at" DATE NOT NULL,
    "source" "ConditionSource" NOT NULL,
    "loan_id" UUID,
    "checked_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_condition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_full_name_idx" ON "employees"("full_name");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_is_active_idx" ON "employees"("is_active");

-- CreateIndex
CREATE INDEX "asset_assignments_asset_id_created_at_idx" ON "asset_assignments"("asset_id", "created_at");

-- CreateIndex
CREATE INDEX "asset_assignments_to_employee_id_idx" ON "asset_assignments"("to_employee_id");

-- CreateIndex
CREATE INDEX "asset_mutations_asset_id_idx" ON "asset_mutations"("asset_id");

-- CreateIndex
CREATE INDEX "asset_mutations_status_requested_at_idx" ON "asset_mutations"("status", "requested_at");

-- CreateIndex
CREATE INDEX "asset_mutations_requested_by_id_idx" ON "asset_mutations"("requested_by_id");

-- CreateIndex
CREATE INDEX "asset_loans_asset_id_idx" ON "asset_loans"("asset_id");

-- CreateIndex
CREATE INDEX "asset_loans_status_due_at_idx" ON "asset_loans"("status", "due_at");

-- CreateIndex
CREATE INDEX "asset_loans_borrower_employee_id_idx" ON "asset_loans"("borrower_employee_id");

-- CreateIndex
CREATE INDEX "asset_condition_logs_asset_id_created_at_idx" ON "asset_condition_logs"("asset_id", "created_at");

-- CreateIndex
CREATE INDEX "asset_photos_condition_log_id_idx" ON "asset_photos"("condition_log_id");

-- CreateIndex
CREATE INDEX "assets_responsible_employee_id_idx" ON "assets"("responsible_employee_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_responsible_employee_id_fkey" FOREIGN KEY ("responsible_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_photos" ADD CONSTRAINT "asset_photos_condition_log_id_fkey" FOREIGN KEY ("condition_log_id") REFERENCES "asset_condition_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_from_employee_id_fkey" FOREIGN KEY ("from_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_to_employee_id_fkey" FOREIGN KEY ("to_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_mutation_id_fkey" FOREIGN KEY ("mutation_id") REFERENCES "asset_mutations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_from_responsible_employee_id_fkey" FOREIGN KEY ("from_responsible_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_to_responsible_employee_id_fkey" FOREIGN KEY ("to_responsible_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_mutations" ADD CONSTRAINT "asset_mutations_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_borrower_employee_id_fkey" FOREIGN KEY ("borrower_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_borrower_department_id_fkey" FOREIGN KEY ("borrower_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_guarantor_employee_id_fkey" FOREIGN KEY ("guarantor_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_loans" ADD CONSTRAINT "asset_loans_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_condition_logs" ADD CONSTRAINT "asset_condition_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_condition_logs" ADD CONSTRAINT "asset_condition_logs_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "asset_loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_condition_logs" ADD CONSTRAINT "asset_condition_logs_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tahap 3: satu mutasi PENDING dan satu pinjaman ACTIVE per barang (indeks unik parsial).
CREATE UNIQUE INDEX "asset_mutations_one_pending" ON "asset_mutations"("asset_id") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "asset_loans_one_active" ON "asset_loans"("asset_id") WHERE "status" = 'ACTIVE';

-- Viewer yang sudah ada mendapat hak melihat daftar mutasi (seed hanya memberi permission baru ke role lama).
INSERT INTO "role_permissions"("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
WHERE r."code" = 'VIEWER' AND p."code" = 'mutations.view'
ON CONFLICT DO NOTHING;
