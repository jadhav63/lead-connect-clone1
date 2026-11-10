-- CreateEnum
CREATE TYPE "AreaFrequency" AS ENUM ('ON_DEMAND', 'DAILY', 'TWICE_DAILY', 'WEEKLY');

-- AlterTable
ALTER TABLE "maintenance_tickets" ADD COLUMN     "publicAreaId" TEXT;

-- CreateTable
CREATE TABLE "public_areas" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "frequency" "AreaFrequency" NOT NULL DEFAULT 'DAILY',
    "weeklyDay" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "checklist" TEXT[],
    "assignedToId" TEXT,
    "assignedStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_area_tasks" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "scheduledFor" DATE NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "assignedStaffId" TEXT,
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "completedById" TEXT,
    "checklist" TEXT[],
    "completedItems" TEXT[],
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_area_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_areas_propertyId_isActive_sortOrder_idx" ON "public_areas"("propertyId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "public_areas_propertyId_id_key" ON "public_areas"("propertyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "public_areas_propertyId_name_key" ON "public_areas"("propertyId", "name");

-- CreateIndex
CREATE INDEX "public_area_tasks_propertyId_scheduledFor_status_idx" ON "public_area_tasks"("propertyId", "scheduledFor", "status");

-- CreateIndex
CREATE INDEX "public_area_tasks_propertyId_assignedToId_scheduledFor_idx" ON "public_area_tasks"("propertyId", "assignedToId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "public_area_tasks_propertyId_areaId_scheduledFor_slot_key" ON "public_area_tasks"("propertyId", "areaId", "scheduledFor", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "staff_directory_propertyId_id_key" ON "staff_directory"("propertyId", "id");

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_propertyId_publicAreaId_fkey" FOREIGN KEY ("propertyId", "publicAreaId") REFERENCES "public_areas"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_areas" ADD CONSTRAINT "public_areas_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_areas" ADD CONSTRAINT "public_areas_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_areas" ADD CONSTRAINT "public_areas_propertyId_assignedStaffId_fkey" FOREIGN KEY ("propertyId", "assignedStaffId") REFERENCES "staff_directory"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_propertyId_areaId_fkey" FOREIGN KEY ("propertyId", "areaId") REFERENCES "public_areas"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_propertyId_assignedStaffId_fkey" FOREIGN KEY ("propertyId", "assignedStaffId") REFERENCES "staff_directory"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth: an issue is about a guest room or a public area, never both.
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_single_location_check" CHECK ("roomId" IS NULL OR "publicAreaId" IS NULL);
ALTER TABLE "public_areas" ADD CONSTRAINT "public_areas_single_assignee_check" CHECK ("assignedToId" IS NULL OR "assignedStaffId" IS NULL);
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_single_assignee_check" CHECK ("assignedToId" IS NULL OR "assignedStaffId" IS NULL);
ALTER TABLE "public_areas" ADD CONSTRAINT "public_areas_weekly_day_check" CHECK ("weeklyDay" BETWEEN 0 AND 6);
ALTER TABLE "public_area_tasks" ADD CONSTRAINT "public_area_tasks_slot_check" CHECK ("slot" BETWEEN 1 AND 10);
