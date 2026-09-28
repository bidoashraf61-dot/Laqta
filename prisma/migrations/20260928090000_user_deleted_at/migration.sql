-- DEV-52: self-service account deletion keeps the row, clears the person.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
