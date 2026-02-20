-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEACHER';

-- CreateTable
CREATE TABLE "studio_teachers" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_teachers_studioId_idx" ON "studio_teachers"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "studio_teachers_studioId_userId_key" ON "studio_teachers"("studioId", "userId");

-- AddForeignKey
ALTER TABLE "studio_teachers" ADD CONSTRAINT "studio_teachers_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_teachers" ADD CONSTRAINT "studio_teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
