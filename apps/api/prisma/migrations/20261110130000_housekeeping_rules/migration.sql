CREATE TABLE "housekeeping_rules" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "rules" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "housekeeping_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "housekeeping_rules_propertyId_key" ON "housekeeping_rules"("propertyId");
ALTER TABLE "housekeeping_rules" ADD CONSTRAINT "housekeeping_rules_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
