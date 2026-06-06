-- Make yandexId nullable (was NOT NULL before)
ALTER TABLE "User" ALTER COLUMN "yandexId" DROP NOT NULL;

-- Add googleId column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;

-- Add unique index for googleId
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");

-- Add Connection table if not exists
CREATE TABLE IF NOT EXISTS "Connection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "subjectId" TEXT,
    "nickname" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Connection_inviteCode_key" ON "Connection"("inviteCode");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Connection_ownerId_fkey') THEN
    ALTER TABLE "Connection" ADD CONSTRAINT "Connection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Connection_subjectId_fkey') THEN
    ALTER TABLE "Connection" ADD CONSTRAINT "Connection_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add PersonNote table if not exists
CREATE TABLE IF NOT EXISTS "PersonNote" (
    "id" SERIAL NOT NULL,
    "connectionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonNote_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PersonNote_connectionId_fkey') THEN
    ALTER TABLE "PersonNote" ADD CONSTRAINT "PersonNote_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PersonNote_authorId_fkey') THEN
    ALTER TABLE "PersonNote" ADD CONSTRAINT "PersonNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
