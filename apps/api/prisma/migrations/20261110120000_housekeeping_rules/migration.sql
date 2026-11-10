-- Versioned, property-scoped housekeeping settings; no existing room or task data changed.
CREATE TABLE "housekeeping_rule_versions" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "settings" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "housekeeping_rule_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "housekeeping_rule_versions_propertyId_version_key" ON "housekeeping_rule_versions"("propertyId","version");
CREATE INDEX "housekeeping_rule_versions_propertyId_createdAt_idx" ON "housekeeping_rule_versions"("propertyId","createdAt");
ALTER TABLE "housekeeping_rule_versions" ADD CONSTRAINT "housekeeping_rule_versions_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_rule_versions" ADD CONSTRAINT "housekeeping_rule_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
