-- AlterTable
ALTER TABLE "LinkedinAccount" ADD COLUMN     "email" TEXT,
ADD COLUMN     "linkedinId" TEXT,
ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedinAccount_linkedinId_key" ON "LinkedinAccount"("linkedinId");
