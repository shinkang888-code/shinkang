-- CreateEnum
CREATE TYPE "PracticePostStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ReviewResult" AS ENUM ('OK', 'NG');

-- CreateEnum
CREATE TYPE "PracticeCommentType" AS ENUM ('GENERAL', 'INSTRUCTION', 'QUESTION', 'ANSWER');

-- CreateEnum
CREATE TYPE "GoalBasis" AS ENUM ('SUBMISSION', 'POST');

-- CreateTable
CREATE TABLE "practice_threads" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_posts" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pieceTitle" TEXT NOT NULL,
    "practiceCount" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" "PracticePostStatus" NOT NULL DEFAULT 'DRAFT',
    "lastRecordingId" TEXT,
    "reviewResult" "ReviewResult",
    "reviewComment" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "practice_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_recordings" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "codec" TEXT,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "sizeBytes" INTEGER NOT NULL,

    CONSTRAINT "practice_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_comments" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "postId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "type" "PracticeCommentType" NOT NULL DEFAULT 'GENERAL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,

    CONSTRAINT "practice_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_goal_settings" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "studentId" TEXT,
    "weekTargetCount" INTEGER NOT NULL DEFAULT 3,
    "basis" "GoalBasis" NOT NULL DEFAULT 'SUBMISSION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_goal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_threads_studioId_studentId_idx" ON "practice_threads"("studioId", "studentId");

-- CreateIndex
CREATE INDEX "practice_threads_studioId_date_idx" ON "practice_threads"("studioId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "practice_threads_studioId_studentId_date_key" ON "practice_threads"("studioId", "studentId", "date");

-- CreateIndex
CREATE INDEX "practice_posts_threadId_idx" ON "practice_posts"("threadId");

-- CreateIndex
CREATE INDEX "practice_posts_studioId_studentId_idx" ON "practice_posts"("studioId", "studentId");

-- CreateIndex
CREATE INDEX "practice_posts_studioId_status_idx" ON "practice_posts"("studioId", "status");

-- CreateIndex
CREATE INDEX "practice_recordings_postId_idx" ON "practice_recordings"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_recordings_studioId_storageKey_key" ON "practice_recordings"("studioId", "storageKey");

-- CreateIndex
CREATE INDEX "practice_comments_threadId_pinned_idx" ON "practice_comments"("threadId", "pinned");

-- CreateIndex
CREATE INDEX "practice_comments_postId_idx" ON "practice_comments"("postId");

-- CreateIndex
CREATE INDEX "practice_comments_studioId_threadId_idx" ON "practice_comments"("studioId", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_goal_settings_studioId_studentId_key" ON "practice_goal_settings"("studioId", "studentId");

-- AddForeignKey
ALTER TABLE "practice_threads" ADD CONSTRAINT "practice_threads_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_threads" ADD CONSTRAINT "practice_threads_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_posts" ADD CONSTRAINT "practice_posts_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "practice_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_posts" ADD CONSTRAINT "practice_posts_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_posts" ADD CONSTRAINT "practice_posts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_recordings" ADD CONSTRAINT "practice_recordings_postId_fkey" FOREIGN KEY ("postId") REFERENCES "practice_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_recordings" ADD CONSTRAINT "practice_recordings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_recordings" ADD CONSTRAINT "practice_recordings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_comments" ADD CONSTRAINT "practice_comments_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "practice_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_comments" ADD CONSTRAINT "practice_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "practice_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_comments" ADD CONSTRAINT "practice_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_comments" ADD CONSTRAINT "practice_comments_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_comments" ADD CONSTRAINT "practice_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "practice_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_goal_settings" ADD CONSTRAINT "practice_goal_settings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_goal_settings" ADD CONSTRAINT "practice_goal_settings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
