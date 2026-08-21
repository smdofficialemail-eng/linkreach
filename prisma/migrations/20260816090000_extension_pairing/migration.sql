-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "extensionCode" TEXT,
ADD COLUMN     "extensionName" TEXT,
ADD COLUMN     "extensionPairedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_extensionCode_key" ON "Workspace"("extensionCode");
