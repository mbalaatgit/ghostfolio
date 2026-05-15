-- AlterEnum
ALTER TYPE "Provider" ADD VALUE 'LOCAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
