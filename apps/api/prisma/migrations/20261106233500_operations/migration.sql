-- CreateEnum
CREATE TYPE "FrontDeskTaskKind" AS ENUM ('CHECKLIST', 'INSPECTION', 'OTHER');

-- DropForeignKey
ALTER TABLE "cleaning_tasks" DROP CONSTRAINT "cleaning_tasks_roomId_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "maintenance_tickets_roomId_fkey";

-- DropForeignKey
ALTER TABLE "photos" DROP CONSTRAINT "photos_roomId_fkey";

-- DropForeignKey
ALTER TABLE "photos" DROP CONSTRAINT "photos_ticketId_fkey";

-- CreateTable
CREATE TABLE "front_desk_tasks" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "FrontDeskTaskKind" NOT NULL DEFAULT 'CHECKLIST',
    "shift" TEXT NOT NULL,
    "scheduledFor" DATE NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "front_desk_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_handovers" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "notes" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "front_desk_tasks_propertyId_scheduledFor_shift_status_idx" ON "front_desk_tasks"("propertyId", "scheduledFor", "shift", "status");

-- CreateIndex
CREATE INDEX "shift_handovers_propertyId_businessDate_shift_idx" ON "shift_handovers"("propertyId", "businessDate", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_tickets_propertyId_id_key" ON "maintenance_tickets"("propertyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_propertyId_id_key" ON "rooms"("propertyId", "id");

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_propertyId_roomId_fkey" FOREIGN KEY ("propertyId", "roomId") REFERENCES "rooms"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_propertyId_roomId_fkey" FOREIGN KEY ("propertyId", "roomId") REFERENCES "rooms"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_propertyId_roomId_fkey" FOREIGN KEY ("propertyId", "roomId") REFERENCES "rooms"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_propertyId_ticketId_fkey" FOREIGN KEY ("propertyId", "ticketId") REFERENCES "maintenance_tickets"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_tasks" ADD CONSTRAINT "front_desk_tasks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_tasks" ADD CONSTRAINT "front_desk_tasks_propertyId_roomId_fkey" FOREIGN KEY ("propertyId", "roomId") REFERENCES "rooms"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_tasks" ADD CONSTRAINT "front_desk_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_tasks" ADD CONSTRAINT "front_desk_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_tasks" ADD CONSTRAINT "front_desk_tasks_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
