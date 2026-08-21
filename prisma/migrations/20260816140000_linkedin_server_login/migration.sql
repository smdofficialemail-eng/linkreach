-- AlterTable
ALTER TABLE "LinkedinAccount" ADD COLUMN     "linkedinLogin" TEXT,
ADD COLUMN     "passwordEnc" TEXT,
ADD COLUMN     "sessionStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN     "lastSessionAt" TIMESTAMP(3),
ADD COLUMN     "warmupDay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warmupStartedAt" TIMESTAMP(3),
ADD COLUMN     "sentToday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sentTodayDate" TEXT;
