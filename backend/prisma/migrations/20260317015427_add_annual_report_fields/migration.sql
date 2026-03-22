-- CreateEnum
CREATE TYPE "public"."transport_region" AS ENUM ('HOKKAIDO', 'TOHOKU', 'HOKURIKU', 'KANTO', 'CHUBU', 'KINKI', 'CHUGOKU', 'SHIKOKU', 'KYUSHU', 'OKINAWA');

-- CreateEnum
CREATE TYPE "public"."accident_type" AS ENUM ('TRAFFIC', 'SERIOUS');

-- AlterEnum
ALTER TYPE "public"."ReportType" ADD VALUE 'ANNUAL_TRANSPORT_REPORT';

-- AlterTable
ALTER TABLE "public"."operations" ADD COLUMN     "loaded_distance_km" DECIMAL(8,2),
ADD COLUMN     "revenue_yen" INTEGER;

-- AlterTable
ALTER TABLE "public"."vehicles" ADD COLUMN     "region" "public"."transport_region";

-- CreateTable
CREATE TABLE "public"."accident_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "accident_date" DATE NOT NULL,
    "accident_type" "public"."accident_type" NOT NULL,
    "vehicle_id" UUID,
    "driver_id" UUID,
    "operation_id" UUID,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "injuries" INTEGER NOT NULL DEFAULT 0,
    "region" "public"."transport_region",
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accident_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transport_business_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "business_number" VARCHAR(20),
    "company_name" VARCHAR(200) NOT NULL DEFAULT '',
    "address" VARCHAR(500),
    "representative_name" VARCHAR(100),
    "phone_number" VARCHAR(30),
    "submission_target" VARCHAR(100),
    "business_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_accident_records_date" ON "public"."accident_records"("accident_date");

-- CreateIndex
CREATE INDEX "idx_accident_records_type" ON "public"."accident_records"("accident_type");

-- CreateIndex
CREATE INDEX "idx_accident_records_vehicle" ON "public"."accident_records"("vehicle_id");

-- CreateIndex
CREATE INDEX "idx_accident_records_region" ON "public"."accident_records"("region");

-- CreateIndex
CREATE INDEX "idx_vehicles_region" ON "public"."vehicles"("region");

-- AddForeignKey
ALTER TABLE "public"."accident_records" ADD CONSTRAINT "accident_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."accident_records" ADD CONSTRAINT "accident_records_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."accident_records" ADD CONSTRAINT "accident_records_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
