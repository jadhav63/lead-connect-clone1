-- CreateEnum
CREATE TYPE "AccessGrantPurpose" AS ENUM ('ACTIVATE', 'RECOVER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "staff_directory" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "employee_access_grants" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "purpose" "AccessGrantPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_access_grants_tokenHash_key" ON "employee_access_grants"("tokenHash");

-- CreateIndex
CREATE INDEX "employee_access_grants_propertyId_userId_expiresAt_idx" ON "employee_access_grants"("propertyId", "userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "staff_directory_propertyId_userId_key" ON "staff_directory"("propertyId", "userId");

-- AddForeignKey
ALTER TABLE "staff_directory" ADD CONSTRAINT "staff_directory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_access_grants" ADD CONSTRAINT "employee_access_grants_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_access_grants" ADD CONSTRAINT "employee_access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_access_grants" ADD CONSTRAINT "employee_access_grants_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
