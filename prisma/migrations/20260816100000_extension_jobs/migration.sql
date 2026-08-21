-- CreateTable
CREATE TABLE "ExtensionJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "memberId" TEXT,
    "leadId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExtensionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtensionJob_workspaceId_status_idx" ON "ExtensionJob"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "ExtensionJob" ADD CONSTRAINT "ExtensionJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
