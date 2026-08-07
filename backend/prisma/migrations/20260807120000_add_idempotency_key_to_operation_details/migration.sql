-- AlterTable
ALTER TABLE "public"."operation_details" ADD COLUMN "idempotency_key" VARCHAR(64);

-- CreateIndex（PostgreSQLの複合UNIQUE indexはNULL同士を区別するため、
-- idempotency_key が NULL の既存レコード・未対応クライアントからのリクエストには影響しない）
CREATE UNIQUE INDEX "uq_operation_details_op_idempotency" ON "public"."operation_details"("operation_id", "idempotency_key");
