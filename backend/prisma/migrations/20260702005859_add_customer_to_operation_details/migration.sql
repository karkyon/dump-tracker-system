-- AlterTable
ALTER TABLE "public"."operation_details" ADD COLUMN "customer_id" UUID;

-- AddForeignKey
ALTER TABLE "public"."operation_details" ADD CONSTRAINT "operation_details_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateIndex
CREATE INDEX "idx_operation_details_customer" ON "public"."operation_details"("customer_id");
