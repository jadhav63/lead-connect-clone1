-- Separate personnel directory from authenticated users. No real staff are seeded.
CREATE TABLE "staff_directory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "department" TEXT,
    "jobRole" TEXT,
    "employmentStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "appAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_directory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_directory_propertyId_normalizedName_key" ON "staff_directory"("propertyId", "normalizedName");
CREATE INDEX "staff_directory_propertyId_employmentStatus_idx" ON "staff_directory"("propertyId", "employmentStatus");
ALTER TABLE "staff_directory" ADD CONSTRAINT "staff_directory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
