-- LinkedInProfile
CREATE TABLE IF NOT EXISTS "LinkedInProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "linkedinId" TEXT,
    "publicId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "location" TEXT,
    "industry" TEXT,
    "profileUrl" TEXT,
    "avatarUrl" TEXT,
    "about" TEXT,
    "connectionDegree" INTEGER,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isOpenToWork" BOOLEAN NOT NULL DEFAULT false,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "mutualConnections" INTEGER,
    "raw" JSONB,
    "source" TEXT NOT NULL DEFAULT 'search',
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkedInProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LinkedInProfile_workspaceId_linkedinId_key" ON "LinkedInProfile"("workspaceId", "linkedinId");
CREATE INDEX IF NOT EXISTS "LinkedInProfile_workspaceId_idx" ON "LinkedInProfile"("workspaceId");

-- OutreachSelection
CREATE TABLE IF NOT EXISTS "OutreachSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "linkedinProfileId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachSelection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutreachSelection_linkedinProfileId_fkey" FOREIGN KEY ("linkedinProfileId") REFERENCES "LinkedInProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OutreachSelection_workspaceId_linkedinProfileId_key" ON "OutreachSelection"("workspaceId", "linkedinProfileId");

-- Template
CREATE TABLE IF NOT EXISTS "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'connection_note',
    "variables" JSONB DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Template_workspaceId_category_idx" ON "Template"("workspaceId", "category");

-- BlacklistEntry
CREATE TABLE IF NOT EXISTS "BlacklistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "linkedinProfileId" TEXT,
    "profileUrl" TEXT,
    "name" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlacklistEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlacklistEntry_linkedinProfileId_fkey" FOREIGN KEY ("linkedinProfileId") REFERENCES "LinkedInProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BlacklistEntry_linkedinProfileId_key" ON "BlacklistEntry"("linkedinProfileId");
CREATE INDEX IF NOT EXISTS "BlacklistEntry_workspaceId_idx" ON "BlacklistEntry"("workspaceId");

-- ScheduledAction
CREATE TABLE IF NOT EXISTS "ScheduledAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "linkedinAccountId" TEXT,
    "stepId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduledAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ScheduledAction_workspaceId_status_idx" ON "ScheduledAction"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "ScheduledAction_workspaceId_scheduledAt_idx" ON "ScheduledAction"("workspaceId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "ScheduledAction_status_scheduledAt_idx" ON "ScheduledAction"("status", "scheduledAt");

-- AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Notification_workspaceId_read_idx" ON "Notification"("workspaceId", "read");

-- Plan
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "displayName" TEXT NOT NULL,
    "maxAccounts" INTEGER NOT NULL DEFAULT 1,
    "maxCampaigns" INTEGER NOT NULL DEFAULT 1,
    "maxLeads" INTEGER NOT NULL DEFAULT 100,
    "maxMessagesDay" INTEGER NOT NULL DEFAULT 50,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL UNIQUE,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON UPDATE CASCADE
);

-- Add new columns to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "linkedinProfileId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "about" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new';

-- Add foreign key for Lead.linkedinProfileId (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_linkedinProfileId_fkey') THEN
        ALTER TABLE "Lead" ADD CONSTRAINT "Lead_linkedinProfileId_fkey" FOREIGN KEY ("linkedinProfileId") REFERENCES "LinkedInProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_linkedinProfileId_key" ON "Lead"("linkedinProfileId");
CREATE INDEX IF NOT EXISTS "Lead_linkedinProfileId_idx" ON "Lead"("linkedinProfileId");

-- Add relations to Workspace (these are just conceptual — the foreign keys are on the child tables)
-- Seed default plans
INSERT INTO "Plan" ("id", "name", "displayName", "maxAccounts", "maxCampaigns", "maxLeads", "maxMessagesDay", "priceMonthly", "createdAt")
VALUES
    ('plan_free', 'free', 'Free', 1, 1, 100, 50, 0, CURRENT_TIMESTAMP),
    ('plan_starter', 'starter', 'Starter', 3, 10, 2500, 200, 2900, CURRENT_TIMESTAMP),
    ('plan_professional', 'professional', 'Professional', 10, 50, 25000, 1000, 7900, CURRENT_TIMESTAMP),
    ('plan_agency', 'agency', 'Agency', 50, 999, 999999, 9999, 19900, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
