-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('DAILY_OPERATION', 'MONTHLY_OPERATION', 'VEHICLE_UTILIZATION', 'INSPECTION_SUMMARY', 'TRANSPORTATION_SUMMARY', 'CUSTOM', 'COMPREHENSIVE_DASHBOARD', 'KPI_ANALYSIS', 'PREDICTIVE_ANALYTICS', 'MAINTENANCE_REPORT', 'COST_ANALYSIS', 'PERFORMANCE_REPORT');

-- CreateEnum
CREATE TYPE "public"."ReportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV', 'JSON', 'HTML');

-- CreateEnum
CREATE TYPE "public"."ReportGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."fuel_type" AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "public"."input_type" AS ENUM ('CHECKBOX', 'TEXT', 'NUMBER', 'SELECT');

-- CreateEnum
CREATE TYPE "public"."inspection_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."inspection_type" AS ENUM ('PRE_TRIP', 'POST_TRIP', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."location_type" AS ENUM ('LOADING', 'UNLOADING', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."maintenance_type" AS ENUM ('ROUTINE', 'REPAIR', 'INSPECTION', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "public"."maintenance_status" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DELAYED');

-- CreateEnum
CREATE TYPE "public"."notification_type" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS', 'MAINTENANCE', 'INSPECTION', 'TRIP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."notification_status" AS ENUM ('UNREAD', 'READ', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."notification_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."item_type" AS ENUM ('MATERIAL', 'EQUIPMENT', 'TOOL', 'CONSUMABLE', 'SPARE_PART');

-- CreateEnum
CREATE TYPE "public"."activity_type" AS ENUM ('LOADING', 'UNLOADING', 'TRANSPORTING', 'WAITING', 'MAINTENANCE', 'REFUELING', 'BREAK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."operation_status" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."operation_type" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'AUTH', 'LOGIN', 'LOGOUT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."user_role" AS ENUM ('ADMIN', 'MANAGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "public"."vehicle_status" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "table_name" VARCHAR(100) NOT NULL,
    "operation_type" VARCHAR(20) NOT NULL,
    "record_id" UUID,
    "user_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gps_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "vehicle_id" UUID NOT NULL,
    "operation_id" UUID,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "altitude" DECIMAL(8,2),
    "speed_kmh" DECIMAL(5,2),
    "heading" DECIMAL(5,2),
    "accuracy_meters" DECIMAL(5,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inspection_item_results" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "inspection_record_id" UUID NOT NULL,
    "inspection_item_id" UUID NOT NULL,
    "result_value" TEXT,
    "is_passed" BOOLEAN,
    "notes" TEXT,
    "defect_level" VARCHAR(20),
    "photo_urls" TEXT[],
    "attachment_urls" TEXT[],
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_item_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inspection_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "inspection_type" "public"."inspection_type" NOT NULL,
    "input_type" "public"."input_type" NOT NULL DEFAULT 'CHECKBOX',
    "category" VARCHAR(100),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_value" TEXT,
    "validation_rules" JSONB,
    "help_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inspection_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "operation_id" UUID,
    "vehicle_id" UUID NOT NULL,
    "inspector_id" UUID NOT NULL,
    "inspection_type" "public"."inspection_type" NOT NULL,
    "status" "public"."inspection_status" NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "overall_result" BOOLEAN,
    "overall_notes" TEXT,
    "defects_found" INTEGER DEFAULT 0,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "location_name" VARCHAR(255),
    "weather_condition" VARCHAR(50),
    "temperature" DECIMAL(4,1),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "item_type" "public"."item_type",
    "unit" VARCHAR(20) DEFAULT 'トン',
    "standard_weight" DECIMAL(5,2),
    "hazardous" BOOLEAN DEFAULT false,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "standard_volume" DECIMAL(5,2),
    "hazardous_class" VARCHAR(100),
    "handling_instructions" VARCHAR(50),
    "storage_requirements" VARCHAR(100),
    "temperature_range" VARCHAR(50),
    "is_fragile" BOOLEAN,
    "is_hazardous" BOOLEAN,
    "requires_special_equipment" BOOLEAN,
    "display_order" INTEGER,
    "photo_urls" VARCHAR(500),
    "specification_file_url" VARCHAR(500),
    "msds_file_url" VARCHAR(500),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "location_type" "public"."location_type" NOT NULL,
    "client_name" VARCHAR(255),
    "contact_person" VARCHAR(100),
    "contact_phone" VARCHAR(20),
    "contact_email" VARCHAR(255),
    "operating_hours" TEXT,
    "special_instructions" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "hazardous_area" BOOLEAN,
    "access_restrictions" TEXT,
    "parking_instructions" TEXT,
    "unloading_instructions" TEXT,
    "equipment_available" TEXT,
    "photo_urls" TEXT[],

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."maintenance_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "vehicle_id" UUID NOT NULL,
    "maintenance_type" "public"."maintenance_type" NOT NULL,
    "scheduled_date" DATE,
    "completed_date" DATE,
    "mileage_at_maintenance" INTEGER,
    "cost" DECIMAL(10,2),
    "vendor_name" VARCHAR(255),
    "description" TEXT,
    "next_maintenance_date" DATE,
    "next_maintenance_mileage" INTEGER,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."maintenance_status" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "title" VARCHAR(255),
    "message" TEXT,
    "type" "public"."notification_type" NOT NULL DEFAULT 'INFO',
    "status" "public"."notification_status" NOT NULL DEFAULT 'UNREAD',
    "priority" "public"."notification_priority" NOT NULL DEFAULT 'MEDIUM',

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operation_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "operation_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "activity_type" VARCHAR(20) NOT NULL,
    "location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "planned_time" TIMESTAMPTZ(6),
    "actual_start_time" TIMESTAMPTZ(6),
    "actual_end_time" TIMESTAMPTZ(6),
    "quantity_tons" DECIMAL(8,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "operation_number" VARCHAR(50) NOT NULL DEFAULT '',
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "status" "public"."operation_status" DEFAULT 'PLANNING',
    "planned_start_time" TIMESTAMPTZ(6),
    "actual_start_time" TIMESTAMPTZ(6),
    "planned_end_time" TIMESTAMPTZ(6),
    "actual_end_time" TIMESTAMPTZ(6),
    "total_distance_km" DECIMAL(8,2),
    "fuel_consumed_liters" DECIMAL(8,2),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "fuel_cost_yen" DECIMAL(10,2),
    "weather_condition" VARCHAR(50),
    "road_condition" VARCHAR(100),
    "start_odometer" DECIMAL(8,2),
    "start_fuel_level" DECIMAL(8,2),

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT,
    "description" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "public"."user_role" DEFAULT 'DRIVER',
    "employee_id" VARCHAR(50),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "plate_number" VARCHAR(20) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "manufacturer" VARCHAR(100),
    "year" INTEGER,
    "fuel_type" "public"."fuel_type" DEFAULT 'DIESEL',
    "capacity_tons" DECIMAL(5,2),
    "current_mileage" INTEGER DEFAULT 0,
    "status" "public"."vehicle_status" DEFAULT 'ACTIVE',
    "purchase_date" DATE,
    "insurance_expiry" DATE,
    "inspection_expiry" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "vehicle_type" VARCHAR(20),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "report_type" "public"."ReportType" NOT NULL,
    "format" "public"."ReportFormat" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "generated_by" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ(6),
    "status" "public"."ReportGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "parameters" JSONB,
    "result_data" JSONB,
    "file_path" VARCHAR(500),
    "file_size" INTEGER,
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "shared_with" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_logs_operation" ON "public"."audit_logs"("operation_type");

-- CreateIndex
CREATE INDEX "idx_audit_logs_table" ON "public"."audit_logs"("table_name");

-- CreateIndex
CREATE INDEX "idx_audit_logs_time" ON "public"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_gps_logs_time" ON "public"."gps_logs"("recorded_at");

-- CreateIndex
CREATE INDEX "idx_gps_logs_vehicle" ON "public"."gps_logs"("vehicle_id");

-- CreateIndex
CREATE INDEX "idx_inspection_item_results_item" ON "public"."inspection_item_results"("inspection_item_id");

-- CreateIndex
CREATE INDEX "idx_inspection_item_results_passed" ON "public"."inspection_item_results"("is_passed");

-- CreateIndex
CREATE INDEX "idx_inspection_item_results_record" ON "public"."inspection_item_results"("inspection_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_item_results_unique" ON "public"."inspection_item_results"("inspection_record_id", "inspection_item_id");

-- CreateIndex
CREATE INDEX "idx_inspection_items_order" ON "public"."inspection_items"("inspection_type", "display_order");

-- CreateIndex
CREATE INDEX "idx_inspection_items_type" ON "public"."inspection_items"("inspection_type");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_items_name_type_unique" ON "public"."inspection_items"("name", "inspection_type");

-- CreateIndex
CREATE INDEX "idx_inspection_records_date" ON "public"."inspection_records"("created_at");

-- CreateIndex
CREATE INDEX "idx_inspection_records_inspector" ON "public"."inspection_records"("inspector_id");

-- CreateIndex
CREATE INDEX "idx_inspection_records_status" ON "public"."inspection_records"("status");

-- CreateIndex
CREATE INDEX "idx_inspection_records_type" ON "public"."inspection_records"("inspection_type");

-- CreateIndex
CREATE INDEX "idx_inspection_records_vehicle" ON "public"."inspection_records"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_name_key" ON "public"."items"("name");

-- CreateIndex
CREATE INDEX "idx_items_display_order" ON "public"."items"("display_order");

-- CreateIndex
CREATE INDEX "idx_items_hazardous" ON "public"."items"("hazardous");

-- CreateIndex
CREATE INDEX "idx_items_is_fragile" ON "public"."items"("is_fragile");

-- CreateIndex
CREATE INDEX "idx_items_is_hazardous" ON "public"."items"("is_hazardous");

-- CreateIndex
CREATE INDEX "idx_items_requires_special_equipment" ON "public"."items"("requires_special_equipment");

-- CreateIndex
CREATE UNIQUE INDEX "idx_locations_name" ON "public"."locations"("name");

-- CreateIndex
CREATE INDEX "idx_locations_hazardous_area" ON "public"."locations"("hazardous_area");

-- CreateIndex
CREATE INDEX "idx_locations_type" ON "public"."locations"("location_type");

-- CreateIndex
CREATE INDEX "idx_maintenance_status" ON "public"."maintenance_records"("status");

-- CreateIndex
CREATE INDEX "idx_maintenance_type" ON "public"."maintenance_records"("maintenance_type");

-- CreateIndex
CREATE INDEX "idx_maintenance_vehicle" ON "public"."maintenance_records"("vehicle_id");

-- CreateIndex
CREATE INDEX "idx_notifications_status" ON "public"."notifications"("status");

-- CreateIndex
CREATE INDEX "idx_notifications_type" ON "public"."notifications"("type");

-- CreateIndex
CREATE INDEX "idx_notifications_priority" ON "public"."notifications"("priority");

-- CreateIndex
CREATE INDEX "idx_notifications_status_priority" ON "public"."notifications"("status", "priority");

-- CreateIndex
CREATE INDEX "idx_operation_details_activity" ON "public"."operation_details"("activity_type");

-- CreateIndex
CREATE INDEX "idx_operation_details_item" ON "public"."operation_details"("item_id");

-- CreateIndex
CREATE INDEX "idx_operation_details_location" ON "public"."operation_details"("location_id");

-- CreateIndex
CREATE INDEX "idx_operation_details_operation" ON "public"."operation_details"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_details_operation_id_sequence_number_key" ON "public"."operation_details"("operation_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "operations_operation_number_key" ON "public"."operations"("operation_number");

-- CreateIndex
CREATE INDEX "idx_operations_driver" ON "public"."operations"("driver_id");

-- CreateIndex
CREATE INDEX "idx_operations_status" ON "public"."operations"("status");

-- CreateIndex
CREATE INDEX "idx_operations_vehicle" ON "public"."operations"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "idx_users_username" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "public"."vehicles"("plate_number");

-- CreateIndex
CREATE INDEX "idx_vehicles_plate_number" ON "public"."vehicles"("plate_number");

-- CreateIndex
CREATE INDEX "idx_vehicles_status" ON "public"."vehicles"("status");

-- CreateIndex
CREATE INDEX "idx_reports_type" ON "public"."reports"("report_type");

-- CreateIndex
CREATE INDEX "idx_reports_user" ON "public"."reports"("generated_by");

-- CreateIndex
CREATE INDEX "idx_reports_status" ON "public"."reports"("status");

-- CreateIndex
CREATE INDEX "idx_reports_created" ON "public"."reports"("created_at");

-- CreateIndex
CREATE INDEX "idx_reports_period" ON "public"."reports"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."gps_logs" ADD CONSTRAINT "gps_logs_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."gps_logs" ADD CONSTRAINT "gps_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inspection_item_results" ADD CONSTRAINT "inspection_item_results_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inspection_item_results" ADD CONSTRAINT "inspection_item_results_inspection_item_id_fkey" FOREIGN KEY ("inspection_item_id") REFERENCES "public"."inspection_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inspection_item_results" ADD CONSTRAINT "inspection_item_results_inspection_record_id_fkey" FOREIGN KEY ("inspection_record_id") REFERENCES "public"."inspection_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inspection_items" ADD CONSTRAINT "inspection_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inspection_records" ADD CONSTRAINT "inspection_records_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inspection_records" ADD CONSTRAINT "inspection_records_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inspection_records" ADD CONSTRAINT "inspection_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."maintenance_records" ADD CONSTRAINT "maintenance_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."operation_details" ADD CONSTRAINT "operation_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."operation_details" ADD CONSTRAINT "operation_details_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."operation_details" ADD CONSTRAINT "operation_details_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."operations" ADD CONSTRAINT "operations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."operations" ADD CONSTRAINT "operations_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."operations" ADD CONSTRAINT "operations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
