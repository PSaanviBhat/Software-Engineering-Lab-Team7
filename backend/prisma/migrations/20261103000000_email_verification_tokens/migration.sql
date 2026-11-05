ALTER TABLE "User"
ADD COLUMN "verificationTokenHash" TEXT,
ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_verificationTokenHash_key" ON "User"("verificationTokenHash");
