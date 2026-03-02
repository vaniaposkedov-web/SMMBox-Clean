/*
  Warnings:

  - You are about to drop the column `userId` on the `Watermark` table. All the data in the column will be lost.
  - Added the required column `accountId` to the `Watermark` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Account" ADD COLUMN "signature" TEXT;

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "maxAccounts" INTEGER NOT NULL,
    "maxPostsPerDay" INTEGER NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT,
    "mediaUrls" TEXT,
    "publishAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "accountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("accountId", "createdAt", "id", "mediaUrls", "publishAt", "status", "text") SELECT "accountId", "createdAt", "id", "mediaUrls", "publishAt", "status", "text" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "pavilion" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "planId" TEXT,
    CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password", "pavilion", "updatedAt") SELECT "createdAt", "email", "id", "name", "password", "pavilion", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Watermark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "fontFamily" TEXT DEFAULT 'font-sans',
    "visualStyle" TEXT DEFAULT 'glass',
    "hasBackground" BOOLEAN NOT NULL DEFAULT true,
    "textColor" TEXT DEFAULT '#FFFFFF',
    "bgColor" TEXT DEFAULT '#000000',
    "imageUrl" TEXT,
    "position" TEXT NOT NULL DEFAULT 'br',
    "size" INTEGER NOT NULL DEFAULT 100,
    "opacity" INTEGER NOT NULL DEFAULT 90,
    "angle" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Watermark_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Watermark" ("angle", "bgColor", "fontFamily", "hasBackground", "id", "imageUrl", "opacity", "position", "size", "text", "textColor", "type", "updatedAt", "visualStyle") SELECT "angle", "bgColor", "fontFamily", "hasBackground", "id", "imageUrl", "opacity", "position", "size", "text", "textColor", "type", "updatedAt", "visualStyle" FROM "Watermark";
DROP TABLE "Watermark";
ALTER TABLE "new_Watermark" RENAME TO "Watermark";
CREATE UNIQUE INDEX "Watermark_accountId_key" ON "Watermark"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
